/**
 * OpenPrivateCloud
 * Copyright (C) 2023-2024 Amir Czwink (amir130@hotmail.de)
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

interface NoDataEvent
{
    type: "keyStoreUnlocked";
}

interface UserLogInEvent
{
    type: "userLogIn";
    userId: number;
    password: string; //required for managing single sign on scenarios
}

interface UserLogOutEvent
{
    type: "userLogOut";
    userId: number;
}

interface UserPasswordChanged
{
    type: "userPasswordChanged";
    userId: number;
    newPassword: string;
}

interface UserSambaPasswordChangedEvent
{
    type: "userSambaPasswordChanged";
    userId: number;
}

type ClusterEvent = NoDataEvent | UserLogInEvent | UserLogOutEvent | UserPasswordChanged | UserSambaPasswordChangedEvent;

type EventCallback = (event: ClusterEvent) => void;
  
@Injectable
export class ClusterEventsManager
{
    constructor()
    {
        this.listeners = [];
    }

    //Public methods
    public PublishEvent(event: ClusterEvent)
    {
        for (const listener of this.listeners)
            listener(event);
    }

    public RegisterListener(listener: EventCallback)
    {
        this.listeners.push(listener);
    }

    //Private state
    private listeners: EventCallback[];
}