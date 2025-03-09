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
import crypto from "crypto";
import { Injectable } from "acts-util-node";
import { UsersController } from "../data-access/UsersController";
import { HashPassword } from "../common/crypto/passwords";
import { OIDPService } from "./OIDPService";
import { ClusterEventsManager } from "./ClusterEventsManager";

 
@Injectable
export class UsersManager
{
    constructor(private usersController: UsersController, private oidpService: OIDPService,
        private clusterEventsManager: ClusterEventsManager)
    {
    }
    
    //Public methods
    public async MapOAuth2SubjectToOPCUserId(oAuth2Subject: string)
    {
        const userId = await this.MapOAuth2SubjectToOPCUserIdIfExisting(oAuth2Subject);
        if(userId === undefined)
        {
            const response = await this.oidpService.users._any_.get(oAuth2Subject);
            if(response.statusCode !== 200)
                throw new Error("TODO");
            if(response.data.userAccount.type !== "human")
                throw new Error("TODO");

            //TODO: oidp should expose ID
            const userId = await this.usersController.CreateUser(response.data.userAccount.eMailAddress, response.data.ad.userPrincipalName, this.CreateSambaPassword());
            return userId;
        }

        return userId;
    }

    public async QueryGroupMembers(groupId: number)
    {
        const response = await this.oidpService.usergroups._any_.members.get(groupId);
        const ids = [];
        for (const userAccount of response.data)
        {
            const opcUserId = await this.MapOAuth2SubjectToOPCUserIdIfExisting(userAccount.id);
            if(opcUserId !== undefined)
                ids.push(opcUserId);
        }

        return ids;
    }
    
    public async QuerySambaPassword(opcUserId: number)
    {
        const sambaPW = await this.usersController.ReadServiceSecret(opcUserId);
        return sambaPW;
    }

    public async QueryUsersName(opcUserId: number)
    {
        const oAuth2Subject = await this.usersController.QueryOAuth2Subject(opcUserId);
        if(oAuth2Subject === undefined)
            throw new Error("Method not implemented.");
        const response = await this.oidpService.users._any_.get(oAuth2Subject);
        if(response.statusCode !== 200)
            throw new Error("TODO");
        if(response.data.userAccount.type !== "human")
            throw new Error("TODO");

        return response.data.userAccount.givenName;
    }

    public async QueryUsersEMailAddress(opcUserId: number)
    {
        const oAuth2Subject = await this.usersController.QueryOAuth2Subject(opcUserId);
        if(oAuth2Subject === undefined)
            throw new Error("Method not implemented.");
        const response = await this.oidpService.users._any_.get(oAuth2Subject);
        if(response.statusCode !== 200)
            throw new Error("TODO");
        if(response.data.userAccount.type !== "human")
            throw new Error("TODO");

        return response.data.userAccount.eMailAddress;
    }

    public async RotateSambaPassword(oAuth2Subject: string)
    {
        const opcUserId = await this.MapOAuth2SubjectToOPCUserId(oAuth2Subject);
        const newPw = this.CreateSambaPassword();

        await this.usersController.UpdateServiceSecret(opcUserId, newPw);

        this.clusterEventsManager.PublishEvent({
            type: "userSambaPasswordChanged",
            opcUserId
        });
    }

    //Private methods
    private CreateSalt()
    {
        return crypto.randomBytes(16).toString("hex");
    }

    private CreateSambaPassword()
    {
        const pw = crypto.randomBytes(64).toString("hex");
        return HashPassword(pw, this.CreateSalt());
    }

    private async MapOAuth2SubjectToOPCUserIdIfExisting(oAuth2Subject: string)
    {
        const userId = await this.usersController.QueryUserId(oAuth2Subject);
        return userId;
    }
}