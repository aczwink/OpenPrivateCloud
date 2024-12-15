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

import { HTTP, Injectable } from "acts-util-node";
import { API } from "../../dist/oidp-api";
import { ENV_OIDP_CLIENT_ID, ENV_OIDP_CLIENT_SECRET, ENV_OIDP_ENDPOINT } from "../env";
import { AbsURL, ObjectExtensions } from "acts-util-core";

interface RequestData
{
    path: string;
    successStatusCode: number;
}

@Injectable
export class OIDPService extends API
{
    constructor()
    {
        super(req => this.SendRequest(req));
    }

    //Private methods
    private async FetchAccessToken()
    {
        const reqBody = {
            grant_type: "client_credentials",
            client_id: ENV_OIDP_CLIENT_ID,
            client_secret: ENV_OIDP_CLIENT_SECRET,
            scope: "admin",
        };
        const reqBodyString = ObjectExtensions.Entries(reqBody).Map(x => x.key + "=" + x.value).Join("&");
        const sender = new HTTP.RequestSender;
        const response = await sender.SendRequest({
            body: Buffer.from(reqBodyString),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            method: "POST",
            url: AbsURL.Parse(ENV_OIDP_ENDPOINT + "/token")
        });
        const body = response.body.toString("utf-8");
        const parsed = JSON.parse(body);
        return parsed.access_token as string;
    }
    
    private ParseBody(headers: HTTP.ResponseHeaders, body: Buffer)
    {
        switch(headers["Content-Type"]?.mediaType)
        {
            case "application/gzip":
                return body;
            case "text/html":
                return body.toString("utf-8");
        }
    }

    private async SendRequest(req: RequestData)
    {
        const accessToken = await this.FetchAccessToken();

        const oidpEndpoint = AbsURL.Parse(ENV_OIDP_ENDPOINT);

        const sender = new HTTP.RequestSender;
        const response = await sender.SendRequest({
            body: Buffer.alloc(0),
            headers: {
                Authorization: "Bearer " + accessToken
            },
            method: "GET",
            url: new AbsURL({
                host: oidpEndpoint.host,
                path: req.path,
                port: oidpEndpoint.port,
                protocol: oidpEndpoint.protocol,
                queryParams: {},
            }),
        });

        switch(response.statusCode)
        {
            case 401:
                throw new Error(response.body.toString("utf-8"));
        }

        return {
            data: (response.statusCode === req.successStatusCode) ? this.ParseBody(response.headers, response.body) : undefined,
            rawBody: response.body,
            statusCode: response.statusCode,
        };
    }
}