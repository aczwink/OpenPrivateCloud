/**
 * OpenPrivateCloud
 * Copyright (C) 2024 Amir Czwink (amir130@hotmail.de)
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

const clusterSettingsConfigKey = "cluster/settings";
export interface PublicClusterSettings
{
    name: string;
}
   
@Injectable
export class ClusterConfigManager
{
    constructor(private clusterConfigController: ClusterConfigController)
    {
    }

    //Public methods
    public async QueryPublicSettings(): Promise<PublicClusterSettings>
    {
        let settings = await this.clusterConfigController.RequestConfig<PublicClusterSettings>(clusterSettingsConfigKey);
        if(settings === undefined)
        {
            settings = {
                name: "TODO: Set name in 'Cluster settings' => 'Public settings'"
            };
        }

        return settings;
    }

    public async SetPublicSettings(config: PublicClusterSettings)
    {
        await this.clusterConfigController.UpdateOrInsertConfig(clusterSettingsConfigKey, config);
    }
}