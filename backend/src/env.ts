/**
 * OpenPrivateCloud
 * Copyright (C) 2024-2025 Amir Czwink (amir130@hotmail.de)
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
import "dotenv/config";

export const ENV_MASTER_KEYSTORE_PATH = process.env.OPC_MASTER_KEYSTORE_PATH!;
export const ENV_OIDP_CLIENT_ID = process.env.OPC_OIDP_CLIENT_ID!;
export const ENV_OIDP_CLIENT_SECRET = process.env.OPC_OIDP_CLIENT_SECRET!;
export const ENV_OIDP_ENDPOINT = process.env.OPC_OIDP_ENDPOINT!;

export default {
    OIDP_AUDIENCE: process.env.OPC_OIDP_AUDIENCE!,
    OPC_ALLOWED_ORIGINS: process.env.OPC_ALLOWED_ORIGINS!,
    OPC_DB: {
        host: process.env.OPC_DBHOST!,
        user: process.env.OPC_DBUSER!
    }
};