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

import { APIController, Get, NotFound, Path, Query } from "acts-util-apilib";
import { RolesController } from "../data-access/RolesController";


@APIController("roles")
class RolesAPIController
{
    constructor(private rolesController: RolesController)
    {
    }

    @Get()
    public async RequestRoles(
        @Query filter: string
    )
    {
        return await this.rolesController.RequestMatchingRoles(filter);
    }
}

@APIController("roles/{roleId}")
class RoleAPIController
{
    constructor(private rolesController: RolesController)
    {
    }

    @Get()
    public async RequestRole(
        @Path roleId: string
    )
    {
        const role = await this.rolesController.RequestRole(roleId);
        if(role === undefined)
            return NotFound("role does not exist");
        return role;
    }
}