/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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
import { NumberDictionary } from "acts-util-core";

type ProvisionCallback = (userId: number, password: string, resourceId: number) => Promise<void>;
type ProvisionCallbackForHost = (userId: number, password: string, hostId: number) => Promise<void>;

/**
 * This service is used for realizing single sign on scenarios. It provides the users password when the user logs in. The password should never be stored somewhere in a reversible manner.
 */
@Injectable
export class UserCredentialsProvider
{
    constructor(clusterEventsManager: ClusterEventsManager)
    {
        this.callbacks = {};

        clusterEventsManager.RegisterListener(ev => {
            if(ev.type === "userLogIn")
                this.OnUserLogIn(ev.userId, ev.password);
        });
    }

    //Public methods
    public RegisterForUserCredentialProvision(userId: number, resourceId: number, callback: ProvisionCallback)
    {
        const cb = this.callbacks[userId];
        if(cb === undefined)
            this.callbacks[userId] = [{ callback, resourceId }];
        else
            cb.push({ callback, resourceId });
        //TODO: this should somehow be persisted in case the controller node restarts
    }

    public RegisterForUserCredentialProvisionForHost(userId: number, hostId: number, callback: ProvisionCallbackForHost)
    {
        //this works by treating hostId as resourceId. Its a hack
        this.RegisterForUserCredentialProvision(userId, hostId, callback);
    }

    //Private state
    private callbacks: NumberDictionary<{ resourceId: number, callback: ProvisionCallback; }[]>;

    //Event handlers
    private async OnUserLogIn(userId: number, password: string)
    {
        const cb = this.callbacks[userId];
        if(cb !== undefined)
        {
            for(let i = 0; i < cb.length; )
            {
                await cb[i].callback(userId, password, cb[i].resourceId); //TODO: if this throws don't remove from callback list but continue with others
                cb.Remove(i);
            }
        }
    }
}