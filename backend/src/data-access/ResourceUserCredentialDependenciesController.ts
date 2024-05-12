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
import { DBConnectionsManager } from "./DBConnectionsManager";

export enum SyncState
{
    NotProvidedYet = 0,
    Provided = 1,
}

interface UserRow
{
    resourceId: number;
    wantLoginPassword: boolean;
}

@Injectable
export class ResourceUserCredentialDependenciesController
{
    constructor(private dbConnMgr: DBConnectionsManager)
    {
    }

    //Public methods
    public async Add(resourceId: number, userId: number, wantLoginPassword: boolean)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.InsertRow("resources_userCredentialDependencies", {
            resourceId,
            userId,
            wantLoginPassword,
            state: SyncState.NotProvidedYet
        });
    }
    
    public async CleanForResource(resourceId: number)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.DeleteRows("resources_userCredentialDependencies", "resourceId = ?", resourceId);
    }

    public async RequestUserRows(userId: number, state: SyncState)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        const rows = await conn.Select<UserRow>("SELECT resourceId, wantLoginPassword, FROM resources_userCredentialDependencies WHERE userId = ? AND state = ?", userId, state);

        return rows;
    }

    public async SetState(resourceId: number, userId: number, state: SyncState)
    {
        const conn = await this.dbConnMgr.CreateAnyConnectionQueryExecutor();
        await conn.UpdateRows("resources_userCredentialDependencies", { state }, "resourceId = ? AND userId = ?", resourceId, userId);
    }
}