/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2023 Amir Czwink (amir130@hotmail.de)
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
import path from "path";
import { Injectable } from "acts-util-node";
import { RemoteFileSystemManager } from "./RemoteFileSystemManager";
import { RemoteRootFileSystemManager } from "./RemoteRootFileSystemManager";
import { HostStoragesController } from "../data-access/HostStoragesController";
import { ResourcesController } from "../data-access/ResourcesController";
import { LightweightResourceReference, ResourceReference } from "../common/ResourceReference";
import { ResourceGroupsController } from "../data-access/ResourceGroupsController";
import { HostsController } from "../data-access/HostsController";
import { ResourceProviderManager } from "./ResourceProviderManager";
 
@Injectable
export class ResourcesManager
{
    constructor(private remoteFileSystemManager: RemoteFileSystemManager, private remoteRootFileSystemManager: RemoteRootFileSystemManager, private resourceGroupsController: ResourceGroupsController,
        private hostStoragesController: HostStoragesController, private resourcesController: ResourcesController, private hostsController: HostsController, private resourceProviderManager: ResourceProviderManager)
    {
    }
    
    //Public methods
    public BuildResourceStoragePath(resourceReference: LightweightResourceReference)
    {
        return path.join(resourceReference.hostStoragePath, resourceReference.id.toString());
    }

    public async ChangeResourceGroup(resourceReference: ResourceReference, newResourceGroupId: number)
    {
        await this.resourcesController.UpdateResourceGroup(resourceReference.id, newResourceGroupId);

        const newRef = await this.CreateResourceReference(resourceReference.id);
        await this.resourceProviderManager.ExternalResourceIdChanged(newRef!, resourceReference.externalId);
    }
    
    public async ChangeResourceName(resourceReference: ResourceReference, newResourceName: string)
    {
        await this.resourcesController.UpdateResourceName(resourceReference.id, newResourceName);

        const newRef = await this.CreateResourceReference(resourceReference.id);
        await this.resourceProviderManager.ExternalResourceIdChanged(newRef!, resourceReference.externalId);
    }

    public async CreateResourceReference(resourceId: number)
    {
        const resource = await this.resourcesController.QueryResource(resourceId);
        if(resource === undefined)
            return undefined;

        const rg = await this.resourceGroupsController.QueryGroup(resource.instanceGroupId);
        const storage = await this.hostStoragesController.RequestHostStorage(resource!.storageId);
        const host = await this.hostsController.QueryHost(storage!.hostId);
            
        return new ResourceReference({
            id: resource.id,
            name: resource.name,
            resourceGroupName: rg!.name,
            resourceProviderName: resource.resourceProviderName,
            resourceType: resource.instanceType,
            hostId: storage!.hostId,
            hostName: host!.hostName,
            hostStoragePath: storage!.path,
        });
    }

    public CreateResourceReferenceFromExternalId(externalId: string)
    {
        const parts = externalId.substring(1).split("/");
        return this.CreateResourceReferenceFromParts(parts[0], parts[1], parts[2], parts[3]);
    }

    public async CreateResourceReferenceFromParts(resourceGroupName: string, resourceProviderName: string, resourceType: string, name: string): Promise<ResourceReference | undefined>
    {
        const resource = await this.resourcesController.QueryResourceByName(resourceGroupName, resourceProviderName, resourceType, name);
        if(resource === undefined)
            return undefined;

        const storage = await this.hostStoragesController.RequestHostStorage(resource!.storageId);
        const host = await this.hostsController.QueryHost(storage!.hostId);

        return new ResourceReference({
            id: resource.id,
            name: resource.name,
            resourceGroupName,
            resourceProviderName,
            resourceType,
            hostId: storage!.hostId,
            hostName: host!.hostName,
            hostStoragePath: storage!.path,
        });
    }

    public async CreateResourceStorageDirectory(resourceReference: LightweightResourceReference)
    {
        const storagePath = this.BuildResourceStoragePath(resourceReference);
        await this.remoteFileSystemManager.CreateDirectory(resourceReference.hostId, storagePath, {
            mode: 0o770 //bug in ssh2? attributes does not seem to be set
        });
        await this.remoteFileSystemManager.ChangeMode(resourceReference.hostId, storagePath, 0o770);

        return storagePath;
    }

    public async RemoveResourceStorageDirectory(resourceReference: LightweightResourceReference)
    {
        const storagePath = this.BuildResourceStoragePath(resourceReference);
        await this.remoteRootFileSystemManager.RemoveDirectoryRecursive(resourceReference.hostId, storagePath);
    }
}