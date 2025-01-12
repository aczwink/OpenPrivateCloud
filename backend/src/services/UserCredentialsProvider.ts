/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2025 Amir Czwink (amir130@hotmail.de)
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
import { ClusterEventsManager } from "./ClusterEventsManager";
import { UsersController } from "../data-access/UsersController";
import { ResourceUserCredentialDependenciesController, SyncState } from "../data-access/ResourceUserCredentialDependenciesController";
import { ResourceEventsManager } from "./ResourceEventsManager";

/**
 * This service is used for realizing single sign on scenarios. It provides the users password when the user logs in. The password should never be stored somewhere in a reversible manner.
 */
@Injectable
export class UserCredentialsProvider
{
    constructor(clusterEventsManager: ClusterEventsManager, private usersController: UsersController, private resourceUserCredentialDependenciesController: ResourceUserCredentialDependenciesController,
        private resourceEventsManager: ResourceEventsManager
    )
    {
        clusterEventsManager.RegisterListener(ev => {
            if(ev.type === "userLogIn")
                this.OnUserLogIn(ev.userId);
            else if(ev.type === "userSambaPasswordChanged")
                this.ProvideUserSambaPW(ev.userId);
        });
    }

    //Public methods
    public async SetResourceDependencies(resourceId: number, userIds: number[], wantLoginPassword?: boolean)
    {
        await this.resourceUserCredentialDependenciesController.CleanForResource(resourceId);

        const wantLoginPasswordBool = wantLoginPassword === true;

        for (const userId of userIds)
            await this.resourceUserCredentialDependenciesController.Add(resourceId, userId, wantLoginPasswordBool);

        if(!wantLoginPasswordBool)
        {
            for (const userId of userIds)
            {
                this.ProvideCredentials(resourceId, userId);
            }
        }
    }

    public async SetResourceDependenciesByGroups(resourceId: number, userGroupIds: number[], wantLoginPassword?: boolean)
    {
        const members = await userGroupIds.Values().Map(x => this.usersController.QueryMembersOfGroup(x)).PromiseAll();
        const userIds = members.Values().Map(x => x.Values()).Flatten().Distinct(x => x.id).Map(x => x.id);

        await this.SetResourceDependencies(resourceId, userIds.ToArray(), wantLoginPassword);
    }

    //Private methods
    private async ProvideCredentials(resourceId: number, userId: number)
    {
        this.resourceEventsManager.PublishEvent({
            type: "userCredentialsProvided",
            resourceId,
            userId
        });

        await this.resourceUserCredentialDependenciesController.SetState(resourceId, userId, SyncState.Provided);
    }

    private async ProvideUserCredentials(userId: number, syncState: SyncState)
    {
        const userRows = await this.resourceUserCredentialDependenciesController.RequestUserRows(userId, syncState);
        for (const userRow of userRows)
        {
            if(userRow.wantLoginPassword)
                this.ProvideCredentials(userRow.resourceId, userId);
            else
                this.ProvideCredentials(userRow.resourceId, userId);
        }
    }

    private async ProvideUserSambaPW(userId: number)
    {
        const userRows = await this.resourceUserCredentialDependenciesController.RequestUserRows(userId, SyncState.Provided);
        for (const userRow of userRows)
        {
            if(!userRow.wantLoginPassword)
                this.ProvideCredentials(userRow.resourceId, userId);
        }
    }

    //Event handlers
    private OnUserLogIn(userId: number)
    {
        this.ProvideUserCredentials(userId, SyncState.NotProvidedYet);
    }
}