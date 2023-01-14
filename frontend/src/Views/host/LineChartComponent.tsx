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

interface LineChartInput
{
    data: number[];
    id: string;
    labels: string[];
    title: string;
    unit: string;
}

export class LineChartComponent extends Component<LineChartInput>
{
    protected Render(): RenderValue
    {
        this.UpdateChart();
        return <canvas id={this.input.id} />;
    }

    //Private variables
    private chart?: Chart;

    //Private methods
    private UpdateChart()
    {
        const ctx = document.getElementById(this.input.id);
        if(ctx === null)
            return;

        if(this.chart === undefined)
        {
            this.chart = new Chart(ctx as any, {
                type: "line",
                data: {
                    labels: this.input.labels,
                    datasets: [{
                        data: this.input.data,
                        borderColor: '#36A2EB',
                        backgroundColor: '#9BD0F5',
                    }]
                },
                options: {
                    plugins: {
                        legend: {
                            display: false
                        },

                        title: {
                            display: true,
                            text: this.input.title
                        }
                    },

                    responsive: true,

                    scales: {
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: this.input.unit
                            },
                        }
                    },
                },
            });
        }
        else
        {
            this.chart.data.labels = this.input.labels;
            this.chart.data.datasets[0].data = this.input.data;
            this.chart.update();
        }
    }
}