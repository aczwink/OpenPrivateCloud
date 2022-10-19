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


/**
 * @title Properties
 */
export interface ShareProperties
{
    /**
     * @title Are guests allowed to access the share?
     */
    allowGuests: boolean;

    /**
     * Whether this share is publicly visible in the shares list.
     * @title Is public?
     * @default true
     */
    browseable: boolean;

    /**
     * @title Comment
     */
    comment: string;

    /**
     * Maximum permissions for files (not directories)
     * @format permissions
     * @title Creation mask for files
     * @minimum 0
     * @maximum 0o777
     * @default 0o744
     */
    createMask: number;

    /**
     * Maximum permissions for directories
     * @format permissions
     * @title Creation mask for directories
     * @minimum 0
     * @maximum 0o777
     * @default 0o744
     */
    directoryMask: number;

    /**
     * @format path
     * @title Path
     */
    path: string;

    /**
     * Whether this share serves as a printer service.
     * @title Is Printable?
     */
    printable: boolean;

    /**
     * @title Valid users
     */
    validUsers: string[];

    /**
     * Whether the share is read only or not.
     * @title Is Writable?
     */
    writable: boolean;
}

export interface Share
{
    /**
     * @title Name
     * @pattern [a-zA-Z]+
     */
    name: string;

    properties: ShareProperties;
}