/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
import { UsersController } from "../data-access/UsersController";
import { EMailService, MailerSettings } from "./EMailService";
import { ErrorService } from "./ErrorService";

const mailerSettingsConfigKey = "notifications/mailer";
   
@Injectable
export class NotificationsManager
{
    constructor(private errorService: ErrorService, private eMailService: EMailService, private usersController: UsersController,
        private clusterConfigController: ClusterConfigController)
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

    public async SendErrorNotification(userGroupId: number, subject: string, e: unknown)
    {
        const text = this.errorService.ExtractDataAsMultipleLines(e);
        const users = await this.usersController.QueryMembersOfGroup(userGroupId);
        for (const user of users)
        {
            await this.SendNotification(user.emailAddress, subject, text);
        }
    }

    public async SendNotification(recipientEMailAddress: string, subject: string, text: string)
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

    public async SetMailerSettings(config: MailerSettings, userIdThatInitiatedTheChange: number)
    {
        await this.clusterConfigController.UpdateOrInsertConfig(mailerSettingsConfigKey, config);

        const user = await this.usersController.QueryUser(userIdThatInitiatedTheChange);
        this.SendNotification(user!.emailAddress, "Test", "This is a test mail");
    }
}