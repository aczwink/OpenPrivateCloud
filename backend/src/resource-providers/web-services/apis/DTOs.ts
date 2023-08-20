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

interface NodeEnvironmentVariableMappingKeyVaultSecretValueDTO
{
    type: "keyvault-secret";
    /**
     * @format key-vault-reference[secret]
     * @title Secret
     */
    keyVaultSecretReference: string;
}
interface NodeEnvironmentVariableMappingStringValueDTO
{
    type: "string";
    value: string;
}

type NodeEnvironmentVariableMappingValueDTO = NodeEnvironmentVariableMappingKeyVaultSecretValueDTO | NodeEnvironmentVariableMappingStringValueDTO;

export interface NodeEnvironmentVariableMappingDTO
{
    varName: string;
    value: NodeEnvironmentVariableMappingValueDTO;
}

export interface NodeAppServiceConfigDTO
{
    autoStart: boolean;
    env: NodeEnvironmentVariableMappingDTO[];
}