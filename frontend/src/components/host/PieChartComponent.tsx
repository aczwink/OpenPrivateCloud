/**
 * OpenPrivateCloud
 * Copyright (C) 2023 Amir Czwink (amir130@hotmail.de)
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

import Chart from 'chart.js/auto'
import { Component, JSX_CreateElement } from "acfrontend";

interface PieChartInput
{
    data: number[];
    id: string;
    labels: string[];
    title: string;
    unit: string;
}

export class PieChartComponent extends Component<PieChartInput>
{
    protected Render(): RenderValue
    {
        this.UpdateChart();
        return <canvas id={this.input.id} />;
    }

    //Private variables
    private chart?: any;

    //Private methods
    private UpdateChart()
    {
        const ctx = document.getElementById(this.input.id);
        if(ctx === null)
            return;

        if(this.chart === undefined)
        {
            this.chart = new Chart(ctx as any, {
                type: "pie",
                data: {
                    labels: this.input.labels,
                    datasets: [
                        {
                            label: this.input.unit,
                            data: this.input.data,
                            backgroundColor: ['#FFB1C1', '#9BD0F5'],
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: this.input.title
                        }
                    }
                }
            });
        }
        else
        {
            this.chart.data.datasets[0].data = this.input.data;
            this.chart.update();
        }
    }
}