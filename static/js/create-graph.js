/*jshint esversion: 6 */

let width,
  height,
  treeWidth,
  treeHeight,
  nOfLeafs,
  nOfLocations,
  offsetHeight,

  osmInfo,
  osmToLoc,

  hiddenWptSubtrees,
  hiddenLocSubtrees,
  hierarchyOrig,
  hierarchyFiltered,
  browserHierarchy,
  showBrowsers,
  tree,
  dummyRoot;

const iteratecBlue = "#008cd2",
  iteratecBlueLight = "#91c3e6",
  iteratecBlueLighter = "#cde6f5",
  iteratecGrayBlue = "#d7e1eb",
  iteratecMagentaDark = "#731964",
  iteratecMagenta = "#a92183",
  iteratecMagentaLight = "#e6bedc",
  iteratecMagentaLighter = "#faf3f8",
  iteratecGray = "#484848",
  iteratecGrayLighter = "#ededed",
  osmGray = "#2f323a",
  osmGrayDarker = "#989dad",
  orange = "#ff7800",
  red = "#f01715",
  hiddenSubtreeOpacity = 0.4;

function filterWptSubtree(element) {
  if (hiddenWptSubtrees.includes(element.textContent))
    hiddenWptSubtrees.splice(hiddenWptSubtrees.indexOf(element.textContent));
  else
    hiddenWptSubtrees.push(element.textContent);
  filterNodes();
}

function filterLocSubtree(element) {
  d3.select("svg").selectAll(".link-wpt")
    .filter(link => link.targetId == element.id)
    .each(link => {
      const hLS = hiddenLocSubtrees.get(link.sourceName);
      if (hLS.includes(element.textContent))
        hLS.splice(hLS.indexOf(element.textContent));
      else
        hLS.push(element.textContent);
    });

  filterNodes();
}

//Param highlight is false if the links should be unhighlighted, true otherwise.
d3.selection.prototype.markLinks = function(highlight) {
  const defaultNodeColor = "rgb(0, 0, 0)";
  const iteratecMagentaDarkRgb = "rgb(115, 25, 100)";
  return this
    .style("stroke", highlight ? iteratecMagenta : null)
    .style("stroke-width", highlight ? 1.5 : null)
    .each(link => {
      const curTargetStyle = link.targetNode.style("fill");
      if (highlight && curTargetStyle == defaultNodeColor)
        link.targetNode.style("fill", iteratecMagentaDark);
      else if (!highlight && curTargetStyle == iteratecMagentaDarkRgb)
        link.targetNode.style("fill", null);
      if (link.sourceNode) {
        const curSourceStyle = link.sourceNode.style("fill");
        if (highlight && curSourceStyle == defaultNodeColor)
          link.sourceNode.style("fill", iteratecMagentaDark);
        else if (!highlight && curSourceStyle == iteratecMagentaDarkRgb)
          link.sourceNode.style("fill", null);
      }
    });
};

function markOsmNodes(element, highlight) {
  const svg = d3.select("svg");
  let wptIds = [];
  let locIds = [];

  svg.selectAll(".link-osm")
    .filter(link => link.sourceName == element.textContent)
    .markLinks(highlight)
    .each(link => wptIds.push(link.targetId));

  svg.selectAll(".link-wpt")
    .filter(link => wptIds.includes(link.sourceId) &&
      osmToLoc[element.textContent].includes(link.targetName))
    .markLinks(highlight)
    .each(link => locIds.push(link.targetId));

  svg.selectAll(".link-loc")
    .filter(link => locIds.includes(link.sourceId) &&
      osmToLoc[element.textContent].includes(link.sourceName))
    .markLinks(highlight);
}

function markWptNodes(element, highlight) {
  const svg = d3.select("svg");

  svg.selectAll(".link-osm")
    .filter(link => link.targetName == element.textContent)
    .markLinks(highlight)
    .each(osmLink =>
      svg.selectAll(".link-wpt")
      .filter(wptLink => wptLink.sourceName == element.textContent &&
        osmToLoc[osmLink.sourceName].includes(wptLink.targetName))
      .markLinks(highlight)
      .each(wptLink =>
        svg.selectAll(".link-loc")
        .filter(locLink =>
          locLink.sourceId == wptLink.targetId &&
          osmToLoc[osmLink.sourceName].includes(locLink.sourceName))
        .markLinks(highlight)));
}

function markLocUpToRoot(elementHTML, elementId, highlight, svg) {
  svg.selectAll(".link-wpt")
    .filter(link => link.targetId == elementId)
    .markLinks(highlight)
    .each(wptLink =>
      svg.selectAll(".link-osm")
      .filter(osmLink => wptLink.sourceName == osmLink.targetName &&
        osmToLoc[osmLink.sourceName].includes(wptLink.targetName))
      .markLinks(highlight)
      .filter(osmLink => osmToLoc[osmLink.sourceName].includes(elementHTML))
      .markLinks(highlight));
}

function markLocNodes(element, highlight) {
  const svg = d3.select("svg");

  svg.selectAll(".link-loc")
    .filter(link => link.sourceId == element.id)
    .markLinks(highlight);

  markLocUpToRoot(element.textContent, element.id, highlight, svg);
}

function markAgentNodes(element, highlight) {
  const svg = d3.select("svg");

  svg.selectAll(".link-loc")
    .filter(link => link.targetId == element.id)
    .markLinks(highlight)
    .each(link =>
      markLocUpToRoot(link.sourceName, link.sourceId, highlight, svg));
}

function drawScene() {
  document.getElementById("legend").className = "hidden";
  d3.select("svg").selectAll("*").remove();

  const osmTextWidth = 275;
  const agentTextWidth = 350;
  width = window.innerWidth;
  height = Math.max(window.innerHeight, nOfLeafs * 15);
  treeWidth = width - (osmTextWidth + agentTextWidth);
  treeHeight = height - 100;

  const svg = d3.select("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(" + osmTextWidth + "," + 0 + ")");

  // bl.ocks.org/mbostock/4339184
  tree = d3.tree().size([treeHeight, treeWidth])(dummyRoot);

  const nOfWptInstances = hierarchyFiltered.Children.length;
  const treeLinks = tree.links();
  offsetHeight = treeLinks.length ? treeLinks[0].target.x : 10;
  const descendants = dummyRoot.descendants();

  //Remove root node:
  descendants.shift();

  const nodes = svg.selectAll(".node")
    .data(descendants.map((d, i) => ({
      data: d.data,
      depth: d.depth,
      y: d.y,
      x: d.x,
      id: "node" + i.toString(),
    })))
    .enter()
    .append("g")
    .attr("transform", d => "translate(" + d.y + "," + d.x + ")");

  const textNodes = nodes.append("text")
    .attr("class", (d, i) => "node " +
      (i < nOfWptInstances ? "node-wpt" :
        i < nOfWptInstances + nOfLocations ? "node-loc" : "node-agent"))
    .attr("id", (d, i) => "node" + i.toString())
    .attr("dy", 3)
    .style("text-anchor", d => d.depth == 3 || (showBrowsers && d.depth == 2) ?
      "start" : "middle")
    .text(d => d.data.Name);

  nodes.append("title").text(d => d.data.URL);

  const wptNodes = textNodes.filter(".node-wpt");
  const locNodes = textNodes.filter(".node-loc");
  const agentNodes = textNodes.filter(".node-agent");

  agentNodes.append("title").text(d => "Last Check: " + d.data.LastCheck +
    "\n" + "Last Work: " + d.data.LastWork);
  wptNodes.style("fill", d => d.data.Err ? red : null)
    .style("opacity", d => hiddenWptSubtrees.includes(d.data.Name) ?
      hiddenSubtreeOpacity : null);
  agentNodes.style("fill",
    d => d.data.LastCheck >= 30 || d.data.LastWork >= 120 ? orange : null);

  const wptTextWidth = wptNodes
    .nodes().reduce((max, node) => Math.max(max, node.getBBox().width), 0);
  const locTextWidth = locNodes
    .nodes().reduce((max, node) => Math.max(max, node.getBBox().width), 0);
  const locTextWidthFiltered = locNodes.filter(d => d.data.Children.length)
    .nodes().reduce((max, node) => Math.max(max, node.getBBox().width), 0);

  if (showBrowsers)
    locNodes.attr("dx", -locTextWidth / 2);

  treeLinks.forEach((l, i, links) => {
    links[i].target.id = "node" + i.toString();
  });
  //The tree links are holding references to the tree nodes in their member
  //variables source and target. We want to change the y coordinate of the
  //target nodes without changing the y coordinate of the node refered to by
  //the source variable of another link. That's why we need to create a new
  //object.
  treeLinks.forEach((l, i, links) => {
    if (l.target.depth != 3)
      links[i].target = {
        data: l.target.data,
        x: l.target.x,
        y: l.target.y - locTextWidth / 2,
        id: l.target.id,
      };
    links[i].source.y +=
      (l.source.depth == 1 ? wptTextWidth : locTextWidthFiltered) /
      2 / l.source.children.length;
  });

  const links = svg.selectAll(".link")
    .data(treeLinks)
    .enter()
    .append("path")
    .attr("class", (d, i) => "link " +
      (i < nOfWptInstances + nOfLocations ? "link-wpt" : "link-loc"))
    .attr("d", d3.linkHorizontal()
      .x(d => d.y)
      .y(d => d.x))
    .data(treeLinks.map((link, i) => ({
      sourceName: link.source.data.Name,
      sourceId: link.source.id,
      targetName: link.target.data.Name,
      targetId: link.target.id,
      targetNode: textNodes.filter((d, j) => i == j),
    })));

  //The tree is built breadth first. So we can remove the links originating
  //from the root node by removing the first hierarchy.Children.length links
  //by exploiting the d3 data binding by index possibilities.
  links.data(hierarchyFiltered.Children).remove();

  const wptLinkNodes = links.filter(".link-wpt");
  locNodes.style("opacity", loc => {
    let hiddenSubtree = false;
    wptLinkNodes.filter(link => link.targetId == loc.id)
      .each(link => hiddenSubtree = hiddenSubtree ||
        hiddenLocSubtrees.get(link.sourceName).includes(loc.data.Name));
    return hiddenSubtree ? hiddenSubtreeOpacity : null;
  });

  wptNodes.attr("onmouseover", "markWptNodes(this, true)")
    .attr("onmouseout", "markWptNodes(this)")
    .attr("onclick", "filterWptSubtree(this)");
  locNodes.attr("onmouseover", "markLocNodes(this, true)")
    .attr("onmouseout", "markLocNodes(this)")
    .attr("onclick", "filterLocSubtree(this)");
  agentNodes.attr("onmouseover", "markAgentNodes(this, true)")
    .attr("onmouseout", "markAgentNodes(this)");

  const osmNodes = svg.selectAll("node-osm")
    .data(d3.keys(osmInfo))
    .enter()
    .append("g")
    .attr("transform", (osm, i) =>
      "translate(" + 0 + "," + (offsetHeight + 150 * i) + ")");

  const osmTextNodes = osmNodes.append("text")
    .attr("class", "node node-osm")
    .text(osm => osm)
    .style("text-anchor", "end")
    .attr("dy", 3)
    .attr("onmouseover", "markOsmNodes(this, true)")
    .attr("onmouseout", "markOsmNodes(this)")
    .style("fill", osm => osmInfo[osm].Err ? red : null);

  osmNodes.append("title").text(osm => osmInfo[osm].URL);

  d3.keys(osmInfo).forEach((osm, i) => {
    const osmLinks = !tree.children ? [] : tree.children
      .filter(node => osmInfo[osm].Wpts.includes(node.data.URL))
      .map(wptNode => ({
        target: {
          name: wptNode.data.Name,
          nOfChildren: wptNode.data.Children.length,
          depth: wptNode.depth,
          x: wptNode.x,
          y: wptNode.y,
          id: wptNode.id
        }
      }));
    const curOsmNode = osmTextNodes.filter((d, j) => i == j);

    svg.selectAll("foo")
      .data(osmLinks)
      .enter()
      .append("path")
      .attr("class", "link link-osm")
      .attr("d", d3.linkHorizontal()
        .x(d => d ? d.y - (d.nOfChildren ? wptTextWidth : wptTextWidth / 2) : 0)
        .y(d => d ? d.x : offsetHeight + 150 * i))
      .data(osmLinks.map(oL => ({
        sourceNode: curOsmNode,
        sourceName: osm,
        targetName: oL.target.name,
        targetId: oL.target.id,
        targetNode: wptNodes.filter(node => node.data.Name == oL.target.name)
      })));
  });

  document.getElementById("legend").className = null;
}

function filterNodes() {
  const filterText = document.getElementById("filterByText").elements;
  const filterNodes = document.getElementById("filterNodes").elements;
  showBrowsers = filterNodes.showBrowsers.checked;

  filterNodes.hideOffline.disabled = showBrowsers;

  //Copy assignment
  hierarchyFiltered = JSON.parse(JSON.stringify(
    showBrowsers ? browserHierarchy : hierarchyOrig));
  hierarchyFiltered.Children = hierarchyFiltered.Children.filter(wpt =>
    wpt.Name.toLowerCase().includes(filterText.wpt.value.toLowerCase()));
  hierarchyFiltered.Children.forEach((wpt, i, wpts) => {
    const hLS = hiddenLocSubtrees.get(wpt.Name);
    wpts[i].Children = wpts[i].Children.filter(loc =>
      !hiddenWptSubtrees.includes(wpt.Name) &&
      loc.Name.toLowerCase().includes(filterText.loc.value.toLowerCase()) &&
      (!filterNodes.hideOffline.checked || !loc.Offline));
    wpts[i].Children.forEach((loc, j, locs) => locs[j].Children =
      loc.Children.filter(agent => !hLS.includes(loc.Name) &&
        agent.Name.toLowerCase().includes(filterText.agent.value.toLowerCase()))
    );
  });

  osmToLoc = new Map();
  Object.keys(osmInfo).forEach(osm => osmToLoc[osm] = showBrowsers ?
    osmInfo[osm].Browsers : osmInfo[osm].Locs);

  prepareHierarchy();
  drawScene();
}

function prepareHierarchy() {
  dummyRoot = d3.hierarchy(hierarchyFiltered, d => d.Children);
  dummyRoot.sort((lhs, rhs) => lhs.data.Name.localeCompare(rhs.data.Name));
  nOfLocations = hierarchyFiltered.Children.reduce(
    (sum, wpt) => sum + wpt.Children.length, 0);
  nOfLeafs = dummyRoot.descendants().reduce(
    (sum, wpt) => sum + (wpt.children ? 0 : 1), 0);
}

d3.json("getData", data => {
  osmInfo = data.OsmToInfo;
  hierarchyOrig = data.Hierarchy;
  browserHierarchy = data.BrowserHierarchy;

  //Wpt text labels are unique, so every wpt node can be unambiguously
  //identified by its label. Location labels are however not unique. That's
  //why we identify location nodes in the map hiddenLocSubtrees by
  //storing the hidden location labels array as the value of its parent wpt
  //node, which is the key.
  hiddenWptSubtrees = ["www.webpagetest.org"];
  hiddenLocSubtrees = new Map(hierarchyOrig.Children.map(
    wpt => [wpt.Name, []]));

  filterNodes();
  window.addEventListener('resize', drawScene);
});
