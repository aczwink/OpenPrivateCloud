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

import { DateTime, Injectable } from "acts-util-node";
import { ErrorService } from "./ErrorService";
import { ResourcesManager } from "./ResourcesManager";
import { NotificationsManager } from "./NotificationsManager";

interface LogContext
{
    error?: unknown;
    resourceId?: number;
}

enum Severity
{
    Error
}
 
@Injectable
export class LoggingService
{
    constructor(private errorService: ErrorService, private resourcesManager: ResourcesManager, private notificationsManager: NotificationsManager)
    {
    }

    public LogError(errorMessage: string, context?: LogContext)
    {
        this.LogLine(Severity.Error, errorMessage, context);
    }

    //Private methods
    private async ContextToString(context?: LogContext)
    {
        if(context === undefined)
            return "";

        const result = [];
        if(context.resourceId !== undefined)
        {
            const str = await this.ResourceIdToString(context.resourceId);
            result.push("resourceId: " + str);
        }
        if(context.error !== undefined)
            result.push("error details: " + this.errorService.ExtractDataAsMultipleLines(context.error));

        return "Context: " + result.join(" ");
    }

    private InformSomeoneViaNotification(message: string, line: string)
    {
        const opcUserId = 1; //TODO: can't stay like this
        this.notificationsManager.SendNotification(opcUserId, message, line);
    }

    private LogLine(severity: Severity, message: string, context?: LogContext)
    {
        const line = DateTime.Now().ToISOString() + " " + this.SeverityToString(severity) + ": " + message + " " + this.ContextToString(context);

        if(severity >= Severity.Error)
        {
            console.error(line);
            this.InformSomeoneViaNotification(message, line);
        }
        else
            console.log(line);
    }

    private async ResourceIdToString(resourceId: number)
    {
        const ref = await this.resourcesManager.CreateResourceReference(resourceId);
        if(ref === undefined)
            return resourceId;
        return ref.externalId;
    }

    private SeverityToString(severity: Severity)
    {
        switch(severity)
        {
            case Severity.Error:
                return "ERROR";
        }
    }
}