/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2025 Amir Czwink (amir130@hotmail.de)
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
import { ClusterConfigController } from "../data-access/ClusterConfigController";
import { EMailService, MailerSettings } from "./EMailService";
import { UsersManager } from "./UsersManager";

const mailerSettingsConfigKey = "notifications/mailer";
   
@Injectable
export class NotificationsManager
{
    constructor(private eMailService: EMailService,
        private clusterConfigController: ClusterConfigController, private usersManager: UsersManager)
    {
    }

    //Public methods
    public async IsMailerConfigured()
    {
        const settings = await this.QuerySettings();
        return (settings.host.trim().length > 0);
    }
    
    public async QuerySettings(): Promise<MailerSettings>
    {
        let settings = await this.clusterConfigController.RequestConfig<MailerSettings>(mailerSettingsConfigKey);
        if(settings === undefined)
        {
            settings = {
                host: "",
                port: 587,
                userName: "",
                password: ""
            };
        }

        return settings;
    }

    public async SendNotification(opcUserId: number, subject: string, text: string)
    {
        const emailAddress = await this.usersManager.QueryUsersEMailAddress(opcUserId);
        this.SendNotificationViaEMail(emailAddress, subject, text);
    }

    public async SetMailerSettings(config: MailerSettings, opcUserIdThatInitiatedTheChange: number)
    {
        await this.clusterConfigController.UpdateOrInsertConfig(mailerSettingsConfigKey, config);

        const emailAddress = await this.usersManager.QueryUsersEMailAddress(opcUserIdThatInitiatedTheChange);
        this.SendNotificationViaEMail(emailAddress, "Test", "This is a test mail");
    }

    //Private methods
    private async SendNotificationViaEMail(recipientEMailAddress: string, subject: string, text: string)
    {
        if( await this.IsMailerConfigured() )
        {
            const settings = await this.QuerySettings();
            await this.eMailService.SendMail({
                from: settings.userName,
                subject: "[OpenPrivateCloud Notification]: " + subject,
                text: text,
                to: [recipientEMailAddress],
            }, settings);
        }
    }
}