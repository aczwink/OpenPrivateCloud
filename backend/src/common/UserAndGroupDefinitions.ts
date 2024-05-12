/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2024 Amir Czwink (amir130@hotmail.de)
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
 * The comments are copied from the debian wiki https://wiki.debian.org/SystemGroups
 */
export const linuxSystemGroupsWithPrivileges = {
    /**
     * Users in this group can use the KVM acceleration of virtual machines. 
     */
    kvm: "kvm",

    /**
     * Users in this group can talk with libvirt service via dbus, as defined in /etc/libvirt/libvirtd.conf. 
     */
    libvirt: "libvirt",
};

/**
 * The comments are copied from the debian wiki https://wiki.debian.org/SystemGroups
 */
export const linuxSpecialGroups = {
    /**
     * Some web servers run as www-data. Web content should not be owned by this user, or a compromised web server would be able to rewrite a web site. Data written out by web servers, including log files, will be owned by www-data. 
     */
    "www-data": "www-data"
};

export const opcGroupPrefixes = {
    /**
     * Primary groups for daemons. The "s" stands for service principal
     */
    daemon: "opc-dg-",

    /**
     * OpenPrivateCloud groups are mirrored into hosts
     */
    group: "opc-g-"
};

export const opcSpecialGroups = {
    /**
     * A private group for the host user. No other user should be in this group.
     */
    host: {
        gid: 50000,
        name: "opc-hg",
    },

    /**
     * OpenPrivateCloud users that are synced to linux hosts need a primary group.
     * This group should usually have no permissions/files except such ones that are granted to ALL OpenPrivateCloud users no matter what roles they have assigned.
     * gid: 50001
     */
    userPrimaryGroup: "opc-upg"
};

export const opcSpecialUsers = {
    /**
     * Processes on the host will be executed through this user. The controller uses it for managing the host
     */
    host: {
        name: "opc-hu",
        uid: 50000
    }
};

export const opcUserPrefixes = {
    /**
     * Users for special daemon processes that should run with less privileges than the default "opc" user
     */
    daemon: "opc-du-",

    /**
     * OpenPrivateCloud users are mirrored into hosts
     */
    user: "opc-u-"
};