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

import { APIController, Auth, Body, Get, Put } from "acts-util-apilib";
import { MailerSettings } from "../services/EMailService";
import { NotificationsManager } from "../services/NotificationsManager";
import { AccessToken } from "../api_security";
import { UsersManager } from "../services/UsersManager";

@APIController("cluster/config/notifications")
class ClusterConfigAPIController
{
    constructor(private notificationsManager: NotificationsManager, private usersManager: UsersManager)
    {
    }

    @Get()
    public async QueryNotificationsConfig()
    {
        const settings = await this.notificationsManager.QuerySettings();
        return settings;
    }

    @Put()
    public async UpdateNotificationsConfig(
        @Body config: MailerSettings,
        @Auth("jwt") accessToken: AccessToken
    )
    {
        const opcUserId = await this.usersManager.MapOAuth2SubjectToOPCUserId(accessToken.sub);
        await this.notificationsManager.SetMailerSettings(config, opcUserId);
    }
}