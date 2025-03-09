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

export default {
    AUTH_ENDPOINT: process.env.OPC_AUTH_ENDPOINT!,
    BACKEND: process.env.OPC_BACKEND!,
    BACKEND_PORT: parseInt(process.env.OPC_BACKEND_PORT!),
    BACKEND_PROTOCOL: process.env.OPC_BACKEND_PROTOCOL! as "http" | "https",
    CLIENT_ID: process.env.OPC_CLIENT_ID!,
    ENDSESSION_ENDPOINT: process.env.OPC_ENDSESSION_ENDPOINT!,
    FRONTEND_BASEURL: process.env.OPC_FRONTEND_BASEURL!,
    TOKEN_ENDPOINT: process.env.OPC_TOKEN_ENDPOINT!,
};