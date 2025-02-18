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

import { APIController, Body, Get, Header, Put } from "acts-util-apilib";
import { MailerSettings } from "../services/EMailService";
import { NotificationsManager } from "../services/NotificationsManager";
import { SessionsManager } from "../services/SessionsManager";
import { ClusterKeyStoreManager } from "../services/ClusterKeyStoreManager";
import { ClusterConfigManager, PublicClusterSettings } from "../services/ClusterConfigManager";

@APIController("cluster/keystore")
class _api_
{
    constructor(private clusterKeyStoreManager: ClusterKeyStoreManager)
    {
    }

    @Get("locked")
    public QueryLockedStatus()
    {
        return this.clusterKeyStoreManager.IsLocked();
    }
}

@APIController("cluster/config/notifications")
class ClusterConfigAPIController
{
    constructor(private notificationsManager: NotificationsManager, private sessionsManager: SessionsManager)
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
        @Header Authorization: string
    )
    {
        const userId = this.sessionsManager.GetUserIdFromAuthHeader(Authorization);
        await this.notificationsManager.SetMailerSettings(config, userId);
    }
}

@APIController("cluster/config/settings")
class _api2_
{
    constructor(private clusterConfigManager: ClusterConfigManager)
    {
    }

    @Put()
    public async UpdateConfig(
        @Body config: PublicClusterSettings,
    )
    {
        await this.clusterConfigManager.SetPublicSettings(config);
    }
}