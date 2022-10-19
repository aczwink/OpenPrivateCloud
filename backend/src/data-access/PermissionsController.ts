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
import { DBConnectionsManager } from "./DBConnectionsManager";

@Injectable
export class PermissionsController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods 
    public async QueryGroupsAssociatedWithHost(hostId: number)
    {
        let query = `
        SELECT ip.userGroupId
        FROM instance_permissions ip
        INNER JOIN instances i
            ON ip.instanceId = i.id
        INNER JOIN hosts_storages hs
            ON i.storageId = hs.id
        WHERE hs.hostId = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, hostId);

        return rows.Values().Map(x => x.userGroupId as number).ToSet();
    }

    public async QueryAllUsersRequiredOnHost(hostId: number)
    {
        let query = `
        SELECT ugm.userId
        FROM usergroups_members ugm
        INNER JOIN instance_permissions ip
            ON ugm.groupId = ip.userGroupId
        INNER JOIN instances i
            ON i.id = ip.instanceId
        INNER JOIN hosts_storages hs
            ON hs.id = i.storageId
        WHERE hs.hostId = ?
        `;

        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select(query, hostId);

        return rows.Values().Map(x => x.userId as number).ToSet();
    }
}