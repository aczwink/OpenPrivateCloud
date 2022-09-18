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

import { HTTP, Injectable } from "acts-util-node";
import { RequestHandler } from "acts-util-node/dist/http/RequestHandler";
import { DataResponse } from "acts-util-node/dist/http/Response";
import { SessionsManager } from "./services/SessionsManager";

@Injectable
export class HTTPAuthHandler implements RequestHandler
{
    constructor(private sessionManager: SessionsManager)
    {
    }
    
    //Public Methods
    public async HandleRequest(request: HTTP.Request): Promise<DataResponse | null>
    {
        if( (request.headers.authorization !== undefined) && request.headers.authorization.startsWith("Bearer "))
        {
            const token = request.headers.authorization.substring(7);
            const session = this.sessionManager.GetSession(token);
            if(session !== undefined)
                return null;
        }
        if((request.routePath === "/sessions") && (request.httpMethod === "POST"))
            return null;
        
        return {
            statusCode: 401,
            headers: {},
            data: "invalid token"
        };
    }
}