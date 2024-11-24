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

import { AutoCompleteSelectBox, JSX_CreateElement, RootInjector, Use } from "acfrontend";
import { CustomFormatRegistry } from "acfrontendex";
import { ResourceSelectionComponent } from "./ResourceSelectionComponent";
import { APIService } from "../../services/APIService";
import { KeyVaultObjectReferenceSelectionComponent } from "./KeyVaultObjectReferenceSelectionComponent";
import { RoleSelectionComponent } from "./RoleSelectionComponent";
import { RolePresenter } from "./RolePresenter";

async function LoadHostNames(filterText: string)
{
    const hosts = await Use(APIService).hosts.get();
    filterText = filterText.toLowerCase();

    return hosts.data.Values()
        .Filter(x => x.hostName.includes(filterText.toLowerCase()))
        .Map(x => ({ key: x.hostName, displayValue: x.hostName }))
        .ToArray();
}

export function RegisterCustomFormats()
{
    const cfm = RootInjector.Resolve(CustomFormatRegistry);

    cfm.RegisterFormat("string", "hostName", {
        editor: (value, valueChanged) => <AutoCompleteSelectBox
        onChanged={newValue => valueChanged(newValue.key)}
        onLoadSuggestions={LoadHostNames}
        selection={ (value.trim().length === 0 ? null : ({ key: value, displayValue: value}))} />
    });

    cfm.RegisterFormat("string", "key-vault-reference[certificate]", {
        editor: (value, valueChanged) => <KeyVaultObjectReferenceSelectionComponent objectType="certificate" value={value} onChanged={valueChanged} />,
    });
    cfm.RegisterFormat("string", "key-vault-reference[key]", {
        editor: (value, valueChanged) => <KeyVaultObjectReferenceSelectionComponent objectType="key" value={value} onChanged={valueChanged} />,
    });
    cfm.RegisterFormat("string", "key-vault-reference[secret]", {
        editor: (value, valueChanged) => <KeyVaultObjectReferenceSelectionComponent objectType="secret" value={value} onChanged={valueChanged} />,
    });

    cfm.RegisterFormat("string", /^resource((\[)|(-same-host\[))/, {
        editor: (value, valueChanged, format, context) => {
            const idx = format.indexOf("[");
            const main = format.substring(0, idx);
            const arg = format.substring(idx+1, format.length - 1);
            const parts = arg.split("/");
            const hostName = (main === "resource-same-host") ? (context!.hostName) : undefined;
            return <ResourceSelectionComponent hostName={hostName} resourceProviderName={parts[0]} resourceTypeName={parts[1]} value={value} valueChanged={valueChanged} />;
        }
    });

    cfm.RegisterFormat("string", "role", {
        editor: (value, valueChanged) => <RoleSelectionComponent roleId={value} valueChanged={valueChanged} />,
        presenter: value => <RolePresenter roleId={value} />
    });
}