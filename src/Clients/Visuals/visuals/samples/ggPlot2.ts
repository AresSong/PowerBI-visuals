/*
 *  Power BI Visualizations
 *  Create a custom visualization to integrate with ggplot2 graphics
 *  This can be useful integrating descriptive analytics of PowerBI with statistical analysis, e.g.  Azure Machine Learning web services
 *  Copyright (c) Syed Ahmed
 *  All rights reserved. 
 *  MIT License
 *
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *   
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

/// <reference path="../../_references.ts"/>

module powerbi.visuals.samples {
    import SelectionManager = utility.SelectionManager;
    export interface GgPlot2ViewModel {
        text: string;
        graph: string;
        color: string;
        selector: SelectionId;
        toolTipInfo: TooltipDataItem[];
    }

    export class GgPlot2 implements IVisual {
        public static capabilities: VisualCapabilities = {
            dataRoles: [{
                name: 'Values',
                kind: VisualDataRoleKind.GroupingOrMeasure
            }],
            dataViewMappings: [{
                table: {
                    rows: {
                        for: { in: 'Values' },
                        dataReductionAlgorithm: { window: { count: 100 } }
                    },
                    rowCount: { preferred: { min: 1 } }
                },
            }],
            objects: {
                general: {
                    displayName: data.createDisplayNameGetter('Visual_General'),
                    properties: {
                        fill: {
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Fill'
                        },
                        graph: {
                            type: { text: true },
                            displayName: 'Graph Name'
                        }
                    },
                }
            },
        };

        private dataView: DataView;

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
            var instances: VisualObjectInstance[] = [];
            var dataView = this.dataView;
            switch (options.objectName) {
                case 'general':
                    var general: VisualObjectInstance = {
                        objectName: 'general',
                        displayName: 'General',
                        selector: null,
                        properties: {
                            fill: GgPlot2.getFill(dataView),
                            graph: GgPlot2.getGraph(dataView)
                        }
                    };
                    instances.push(general);
                    break;
            }

            return instances;
        }

        public static converter(dataView: DataView): GgPlot2ViewModel {
            var viewModel: GgPlot2ViewModel = {
                color: GgPlot2.getFill(dataView).solid.color,
                graph: GgPlot2.getGraph(dataView),
                text: "",
                toolTipInfo: [{
                    displayName: 'GGPlot2',
                    value: 'GGPlot2 in PowerBI',
                }],
                selector: SelectionId.createNull()
            };
            var table = dataView.table;
            if (!table) return viewModel;

            viewModel.text = table.rows[0][0];
            if (dataView.categorical) {
                viewModel.selector = dataView.categorical.categories[0].identity
                    ? SelectionId.createWithId(dataView.categorical.categories[0].identity[0])
                    : SelectionId.createNull();
            }

            return viewModel;
        }
        private selectionManager: SelectionManager;
        private root: D3.Selection;
        private svg: D3.Selection;
        public init(options: VisualInitOptions): void {
            this.root = d3.select(options.element.get(0));
            this.selectionManager = new SelectionManager({ hostServices: options.host });

            var viewport = options.viewport;
            this.root.attr({
                'height': viewport.height,
                'width': viewport.width
            });
            this.svg = this.root.append('svg')
                .classed('ggplot2-waiting', true)
                .attr('width', viewport.width)
                .attr('height', viewport.height);
        }
        private ggplot2Loaded: Boolean;
        private svgWidth: number;
        private svgHeight: number;
        private lastGraphName: string;
        public update(options: VisualUpdateOptions) {
            if (!options.dataViews || !options.dataViews[0]) return; // or clear the view, display an error, etc.
            var dataView = this.dataView = options.dataViews[0];

            var viewport = options.viewport;
            var viewModel: GgPlot2ViewModel = GgPlot2.converter(dataView);

            this.root.attr({
                'height': viewport.height,
                'width': viewport.width
            });
            var newGraphName: string = GgPlot2.getGraph(dataView);
            if (this.lastGraphName === newGraphName && this.ggplot2Loaded) {
                this.svg.attr('viewbox', '0 0 ' + viewport.width + ' ' + viewport.height);

                this.svg.attr({
                    'width': viewport.width, 'height': viewport.height
                });
                return;
            }
            var g = this.svg.append('g');

            g.append('text')
                .style('transform', 'translate(50,50)')
                .attr('x', '50%')
                .attr('y', '50%')
                .style('cursor', 'pointer')
                .style('stroke', 'black')
                .style('stroke-width', '0px')
                .style('text-anchor', 'middle')

                .text('loading ggplot2 ...');
            this.lastGraphName = newGraphName;
            d3.xhr('http://birus.cloudapp.net/custom/' + newGraphName, 'text/xml', (xhr) => {
                if (xhr.responseText === null || xhr.responseText.length === 0) {
                    return;
                }
                this.root.selectAll('*').remove();
                this.ggplot2Loaded = true;
                var anyNode: any = this.root.node();
                anyNode.innerHTML = xhr.responseText;
                this.svg = this.root.select('svg');
                this.svgWidth = this.svgWidth || parseInt(this.svg.attr('width'), 10);
                this.svgHeight = this.svgHeight || parseInt(this.svg.attr('height'), 10);
                this.svg.attr({
                    'width': viewport.width, 'height': viewport.height
                });
                this.svg.attr('viewbox', '0 0 ' + viewport.width + ' ' + viewport.height);
                this.root.style('background-color', viewModel.color);
            });
        }

        private static getFill(dataView: DataView): Fill {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                        var fill = <Fill>general['fill'];
                        if (fill)
                            return fill;
                    }
                }
            }
            return { solid: { color: 'silver' } };
        }

        private static getGraph(dataView: DataView): string {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                        var graphName = <string>general['graph'];

                        if (graphName)
                            return graphName;

                    }
                }
            }
            return "test";
        }
        public destroy(): void {
            this.root = null;
        }
    }
}
