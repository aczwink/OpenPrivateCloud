/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * */
import { Injectable } from "acts-util-node";
import { UsersController } from "../../data-access/UsersController";
import { InstancesManager } from "../../services/InstancesManager";
import { ModulesManager } from "../../services/ModulesManager";
import { RemoteCommandExecutor } from "../../services/RemoteCommandExecutor";
import { SystemServicesManager } from "../../services/SystemServicesManager";
import { DeploymentContext } from "../ResourceProvider";
import { ApacheManager } from "./ApacheManager";
import { CertBotListParser } from "./CertBotListParser";
import { LetsEncryptProperties } from "./Properties";
  
@Injectable
export class LetsEncryptManager
{
    constructor(private remoteCommandExecutor: RemoteCommandExecutor, private usersController: UsersController, private modulesManager: ModulesManager,
        private apacheManager: ApacheManager, private systemServicesManager: SystemServicesManager, private instancesManager: InstancesManager)
    {
    }

    //Public methods
    public async GetCert(hostId: number, fullInstanceName: string)
    {
        const certName = this.MapFullInstanceNameToCertificateName(fullInstanceName);

        const certs = await this.ListCertificates(hostId);
        const cert = certs.find(x => x.name === certName);
        return cert!;
    }

    public async RenewCertificateIfRequired(hostId: number, fullInstanceName: string)
    {
        const cert = await this.GetCert(hostId, fullInstanceName);
        const leftTimeUntilRenewal = (Date.now() - cert!.expiryDate.valueOf());
        if(leftTimeUntilRenewal < 30 * 24 * 60 * 60 *1000) //letsencrypt recommends renewing after 60 days. Cert is valid for 90 days.
            await this.RenewCertificate(hostId, this.MapFullInstanceNameToCertificateName(fullInstanceName));
    }

    public async ProvideResource(instanceProperties: LetsEncryptProperties, context: DeploymentContext)
    {
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "letsencrypt");
        await this.modulesManager.EnsureModuleIsInstalled(context.hostId, "apache");

        const user = await this.usersController.QueryUser(context.userId);

        const enabledSiteNames = await this.SaveApacheState(context.hostId);
        await this.PrepareApacheForCertbot(context.hostId, enabledSiteNames);

        const certName = this.MapFullInstanceNameToCertificateName(context.fullInstanceName);
        const command = ["sudo", "certbot", "certonly", "--cert-name", certName, "--webroot", "-w", "/var/www/html/", "-d", instanceProperties.domainName, "-m", user!.emailAddress, "--agree-tos"];
        try
        {
            await this.remoteCommandExecutor.ExecuteCommand(command, context.hostId);
        }
        catch(e)
        {
            throw e;
        }
        finally
        {
            await this.ResetApacheState(context.hostId, enabledSiteNames);
        }
    }

    //Private methods
    private async ListCertificates(hostId: number)
    {
        const result = await this.remoteCommandExecutor.ExecuteBufferedCommand(["sudo", "certbot", "certificates"], hostId);
        const parser = new CertBotListParser();
        return parser.Parse(result.stdOut);
    }

    private MapFullInstanceNameToCertificateName(fullInstanceName: string)
    {
        return this.instancesManager.DeriveInstanceFileNameFromUniqueInstanceName(fullInstanceName);
    }

    private async PrepareApacheForCertbot(hostId: number, enabledSiteNames: string[])
    {
        await enabledSiteNames.Values().Map(name => this.apacheManager.DisableSite(hostId, name)).PromiseAll();
        await this.apacheManager.EnableSite(hostId, "000-default");

        await this.systemServicesManager.RestartService(hostId, "apache2");
    }

    private async RenewCertificate(hostId: number, certName: string)
    {
        const enabledSiteNames = await this.SaveApacheState(hostId);
        await this.PrepareApacheForCertbot(hostId, enabledSiteNames);

        try
        {
            const commands = ["sudo", "certbot", "renew", "--cert-name", certName, "--no-random-sleep-on-renew"];
            await this.remoteCommandExecutor.ExecuteCommand(commands, hostId);
        }
        catch(error)
        {
            throw error;
        }
        finally
        {
            await this.ResetApacheState(hostId, enabledSiteNames);
        }
    }

    private async ResetApacheState(hostId: number, enabledSiteNames: string[])
    {
        await this.apacheManager.DisableSite(hostId, "000-default");
        await enabledSiteNames.Values().Map(name => this.apacheManager.EnableSite(hostId, name)).PromiseAll();

        await this.systemServicesManager.RestartService(hostId, "apache2");
    }
    
    private async SaveApacheState(hostId: number)
    {
        const sites = await this.apacheManager.QuerySites(hostId);
        const enabledSiteNames = sites.Values()
            .Filter(x => x.enabled)
            .Map(x => x.name).ToArray();
        return enabledSiteNames;
    }
}