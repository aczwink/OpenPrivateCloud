/**
 * OpenPrivateCloud
 * Copyright (C) 2025 Amir Czwink (amir130@hotmail.de)
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

import { AbsURL } from "acts-util-core";

const url = AbsURL.Parse(process.env.OPC_BACKEND_URL!);

export default {
    BACKEND: {
        domainName: url.host,
        port: url.port,
        protocol: url.protocol
    },
    CLIENT_ID: process.env.OPC_CLIENT_ID!,
    FRONTEND_BASEURL: process.env.OPC_FRONTEND_BASEURL!,
    OIDP_ENDPOINT: process.env.OPC_OIDP_ENDPOINT!,
};