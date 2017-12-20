/*jshint esversion: 6 */

const osmTextWidth = 320,
  agentTextWidth = 300,
  browserTextWidth = 400,
  edgeSpacing = 7,

  hiddenSubtreeOpacity = 0.4,

  defaultNodeColor = "rgb(47, 50, 58)",
  iteratecMagentaDarkRgb = "rgb(115, 25, 100)",

  browsersLabelClasses = document.getElementById("showBrowsersLabel").classList,
  offlineLabelClasses = document.getElementById("showOfflineLabel").classList,
  showOffline = document.getElementById("showOffline"),
  showBrowsers = document.getElementById("showBrowsers"),
  filterSubstring = document.getElementById("filterSubstring"),
  collapseAll = document.getElementById("collapseAll"),

  iteratecBlue = "#008cd2",
  iteratecBlueLight = "#91c3e6",
  iteratecBlueLighter = "#cde6f5",
  kobaltBlau = "#3732f5",
  kobaltBlauDarker = "#00197d",
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
  red = "#f01715";

let width,
  height,
  treeWidth,
  treeHeight,
  leafTextWidth,
  nOfOsmInstances,
  nOfWptInstances,
  nOfAgents,
  nOfLeafs,
  nOfLocations,
  topOsmX,

  osmInfo,
  osmToLoc,
  osmNames,

  hiddenWptSubtrees,
  hiddenLocSubtrees,
  hierarchyOrig,
  hierarchyFiltered,
  browserHierarchy,
  tree,
  dummyRoot;

function collapse() {
  //Wpt text labels are unique, so every wpt node can be unambiguously
  //identified by its label. Location labels are however not unique. That's
  //why we identify location nodes in the map hiddenLocSubtrees by
  //storing the hidden location labels array as the value of its parent wpt
  //node, which is the key.
  hiddenWptSubtrees = ["www.webpagetest.org"];
  hiddenLocSubtrees = new Map(hierarchyOrig.Children.map(
    wpt => [wpt.Name, []]));

  filter();
}

function filterWptSubtree(element, event, noCollapse) {
  if (event.ctrlKey || event.metaKey) {
    const onlyElementCollapsed =
      hiddenWptSubtrees.length === nOfWptInstances - 1 &&
      !hiddenWptSubtrees.includes(element.textContent);
    if (!noCollapse && onlyElementCollapsed &&
      !hiddenLocSubtrees.get(element.textContent).length) {
      collapse();
    } else {
      hiddenWptSubtrees = hierarchyOrig.Children
        .filter(wpt => wpt.Name !== element.textContent).map(wpt => wpt.Name);
      hiddenLocSubtrees = new Map(hierarchyOrig.Children.map(
        wpt => [wpt.Name, []]));
      filter();
    }
  } else {
    if (hiddenWptSubtrees.includes(element.textContent))
      hiddenWptSubtrees.splice(
        hiddenWptSubtrees.indexOf(element.textContent), 1);
    else
      hiddenWptSubtrees.push(element.textContent);
    filter();
  }
}

function filterLocSubtree(element, event) {
  d3.select("svg").selectAll(".link-wpt")
    .filter(link => link.targetId === element.id)
    .each(link => {
      if (event.ctrlKey || event.metaKey) {
        const subtreesToHide = new Map(hierarchyOrig.Children.map(
          wpt => [wpt.Name, []]));
        hierarchyOrig.Children
          .filter(wpt => wpt.Name === link.sourceName).forEach(wpt =>
            wpt.Children.filter(loc => loc.Name !== element.textContent)
            .forEach(loc =>
              subtreesToHide.get(link.sourceName).push(loc.Name)));

        // Is subtreesToHide already hidden? Then collapse.
        if (hiddenLocSubtrees.get(link.sourceName).length ===
          subtreesToHide.get(link.sourceName).length &&
          !hiddenLocSubtrees.get(link.sourceName).includes(
            element.textContent)) {
          collapse();
        } else {
          filterWptSubtree({
            textContent: link.sourceName
          }, event, true);
          hiddenLocSubtrees = subtreesToHide;
          filter();
        }
      } else {
        const hLS = hiddenLocSubtrees.get(link.sourceName);
        if (hLS.includes(element.textContent))
          hLS.splice(hLS.indexOf(element.textContent), 1);
        else
          hLS.push(element.textContent);
        filter();
      }
    });
}

//Param highlight is false if the links should be unhighlighted, true otherwise.
d3.selection.prototype.markLinks = function(highlight) {
  return this
    .style("stroke", highlight ? iteratecMagenta : null)
    .style("stroke-width", highlight ? 1.5 : null)
    .each(link => {
      const curTargetStyle = link.targetNode.style("fill");
      if (highlight && curTargetStyle === defaultNodeColor)
        link.targetNode.style("fill", iteratecMagentaDark);
      else if (!highlight && curTargetStyle === iteratecMagentaDarkRgb)
        link.targetNode.style("fill", null);
      if (link.sourceNode) {
        const curSourceStyle = link.sourceNode.style("fill");
        if (highlight && curSourceStyle === defaultNodeColor)
          link.sourceNode.style("fill", iteratecMagentaDark);
        else if (!highlight && curSourceStyle === iteratecMagentaDarkRgb)
          link.sourceNode.style("fill", null);
      }
    });
};

function markOsmNodes(element, highlight) {
  const svg = d3.select("svg");
  let wptIds = [];
  let locIds = [];

  d3.select(element).style("fill", highlight ? iteratecMagentaDark : null);

  svg.selectAll(".link-osm")
    .filter(link => link.sourceName === element.textContent)
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
    .filter(link => link.targetName === element.textContent)
    .markLinks(highlight)
    .each(osmLink =>
      svg.selectAll(".link-wpt")
      .filter(wptLink => wptLink.sourceName === element.textContent &&
        osmToLoc[osmLink.sourceName].includes(wptLink.targetName))
      .markLinks(highlight)
      .each(wptLink =>
        svg.selectAll(".link-loc")
        .filter(locLink =>
          locLink.sourceId === wptLink.targetId &&
          osmToLoc[osmLink.sourceName].includes(locLink.sourceName))
        .markLinks(highlight)));
}

function markLocUpToRoot(elementHTML, elementId, highlight, svg) {
  svg.selectAll(".link-wpt")
    .filter(link => link.targetId === elementId)
    .markLinks(highlight)
    .each(wptLink =>
      svg.selectAll(".link-osm")
      .filter(osmLink => wptLink.sourceName === osmLink.targetName &&
        osmToLoc[osmLink.sourceName].includes(wptLink.targetName))
      .markLinks(highlight)
      .filter(osmLink => osmToLoc[osmLink.sourceName].includes(elementHTML))
      .markLinks(highlight));
}

function markLocNodes(element, highlight) {
  const svg = d3.select("svg");

  svg.selectAll(".link-loc")
    .filter(link => link.sourceId === element.id)
    .markLinks(highlight);

  markLocUpToRoot(element.textContent, element.id, highlight, svg);
}

function markAgentNodes(element, highlight) {
  const svg = d3.select("svg");

  svg.selectAll(".link-loc")
    .filter(link => link.targetId === element.id)
    .markLinks(highlight)
    .each(link =>
      markLocUpToRoot(link.sourceName, link.sourceId, highlight, svg));
}

function drawScene() {
  //Avoid jumping of the legend from the top to the bottom by hiding it until
  //the graph is rendered:
  document.getElementById("legend").className = "hidden";
  d3.select("svg").selectAll("*").remove();

  //Subtract a constant from the window.innerWidth to compensate for the width
  //of the vertical scrollbar.
  width = window.innerWidth - 25;
  height = Math.max(window.innerHeight, nOfLeafs * 15);
  treeWidth = width - (osmTextWidth + leafTextWidth);
  treeHeight = height - 100;

  if (!nOfAgents && (!showBrowsers.checked || !nOfLocations)) {
    treeWidth -= leafTextWidth;
    if (!showBrowsers.checked && !nOfLocations) {
      treeWidth /= 2;
    }
  }

  const svg = d3.select("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(" + osmTextWidth + "," + 0 + ")");

  //bl.ocks.org/mbostock/4339184
  tree = d3.tree().size([treeHeight, treeWidth])(dummyRoot);

  const treeLinks = tree.links();
  topOsmX = nOfWptInstances > 1 ? treeLinks[0].target.x : 50;
  bottomOsmX = nOfWptInstances > 1 ? treeLinks[nOfWptInstances - 1].target.x : window.innerHeight - 150;
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
    .append("g");

  const textNodes = nodes.append("text")
    .attr("class", (d, i) => "node " +
      (i < nOfWptInstances ? "node-wpt" :
        i < nOfWptInstances + nOfLocations ? "node-loc" : "node-agent"))
    .attr("id", (d, i) => "node" + i.toString())
    .attr("dy", 3)
    .style("text-anchor", d => d.depth === 3 ? "start" : "middle")
    .text(d => d.data.Name);

  nodes.append("title").text(d => d.data.URL);

  const wptNodes = textNodes.filter(".node-wpt");
  const locNodes = textNodes.filter(".node-loc");
  const agentNodes = textNodes.filter(".node-agent");

  const wptTextWidth = wptNodes
    .nodes().reduce((max, node) => Math.max(max, node.getBBox().width), 0);
  const locTextWidth = locNodes
    .nodes().reduce((max, node) => Math.max(max, node.getBBox().width), 0);
  const locTextWidthFiltered = locNodes.filter(d => d.data.Children.length)
    .nodes().reduce((max, node) => Math.max(max, node.getBBox().width), 0);

  wptNodes.attr("transform", d =>
    "translate(" + (d.y - wptTextWidth / 6) + "," + d.x + ")");
  locNodes.attr("transform", d =>
    "translate(" + (d.y + locTextWidth / 6) + "," + d.x + ")");
  agentNodes.attr("transform", d => "translate(" + d.y + "," + d.x + ")");

  agentNodes.append("title").text(d => "Last Check: " + d.data.LastCheck +
    " min\n" + "Last Work: " + d.data.LastWork + " min");
  wptNodes.style("fill", d => d.data.Err ? red : null)
    .style("opacity", d => hiddenWptSubtrees.includes(d.data.Name) ?
      hiddenSubtreeOpacity : null);
  agentNodes.style("fill", d => d.data.LastCheck >= 30 ? orange : null);

  treeLinks.forEach((l, i, links) => {
    links[i].target.id = "node" + i.toString();
  });
  //The tree links are holding references to the tree nodes in their member
  //variables source and target. We want to change the y coordinate of the
  //target nodes without changing the y coordinate of the node refered to by
  //the source variable of another link. That's why we need to create a new
  //object.
  treeLinks.forEach((l, i, links) => {
    if (l.target.depth === 2) {
      links[i].source.y +=
        (wptTextWidth / 3 + edgeSpacing) / l.source.children.length;
      links[i].target = {
        data: l.target.data,
        x: l.target.x,
        y: l.target.y - locTextWidth / 3 - edgeSpacing,
        id: l.target.id,
      };
    } else {
      links[i].source.y +=
        (locTextWidthFiltered / 2 + locTextWidth / 6 + edgeSpacing) /
        l.source.children.length;
      links[i].target = {
        data: l.target.data,
        x: l.target.x,
        y: l.target.y - edgeSpacing,
        id: l.target.id,
      };
    }
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
      targetNode: textNodes.filter((d, j) => i === j),
    })));

  //The tree is built breadth first. So we can remove the links originating
  //from the root node by removing the first hierarchy.Children.length links
  //by exploiting the d3 data binding by index possibilities.
  links.data(hierarchyFiltered.Children).remove();

  const wptLinkNodes = links.filter(".link-wpt");
  locNodes.style("opacity", loc => {
    let hiddenSubtree = false;
    wptLinkNodes.filter(link => link.targetId === loc.id)
      .each(link => hiddenSubtree = hiddenSubtree ||
        hiddenLocSubtrees.get(link.sourceName).includes(loc.data.Name));
    return hiddenSubtree ? hiddenSubtreeOpacity : null;
  });

  wptNodes.attr("onmouseover", "markWptNodes(this, true)")
    .attr("onmouseout", "markWptNodes(this)")
    .attr("onclick", "filterWptSubtree(this, event)");
  locNodes.attr("onmouseover", "markLocNodes(this, true)")
    .attr("onmouseout", "markLocNodes(this)")
    .attr("onclick", "filterLocSubtree(this, event)");
  agentNodes.attr("onmouseover", "markAgentNodes(this, true)")
    .attr("onmouseout", "markAgentNodes(this)");

  const osmNodeDist = nOfOsmInstances > 1 ?
    (bottomOsmX - topOsmX) / (nOfOsmInstances - 1) : 0;

  const osmNodes = svg.selectAll("node-osm")
    .data(osmNames)
    .enter()
    .append("g")
    .attr("transform", (osm, i) =>
      "translate(" + 0 + "," + (topOsmX + osmNodeDist * i) + ")");

  const osmTextNodes = osmNodes.append("text")
    .attr("class", "node node-osm")
    .text(osm => osm)
    .style("text-anchor", "end")
    .attr("dy", 3)
    .attr("onmouseover", "markOsmNodes(this, true)")
    .attr("onmouseout", "markOsmNodes(this)")
    .style("fill", osm => osmInfo[osm].Err ? red : null);

  osmNodes.append("title").text(osm => osmInfo[osm].URL);

  osmNames.forEach((osm, i) => {
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
    const curOsmNode = osmTextNodes.filter((d, j) => i === j);

    svg.selectAll("foo")
      .data(osmLinks)
      .enter()
      .append("path")
      .attr("class", "link link-osm")
      .attr("d", d3.linkHorizontal()
        .x(d => d ? d.y - (d.nOfChildren ? wptTextWidth + edgeSpacing * 2 :
          wptTextWidth * 2 / 3 + edgeSpacing) : edgeSpacing)
        .y(d => d ? d.x : topOsmX + osmNodeDist * i))
      .data(osmLinks.map(oL => ({
        sourceNode: curOsmNode,
        sourceName: osm,
        targetName: oL.target.name,
        targetId: oL.target.id,
        targetNode: wptNodes.filter(node => node.data.Name === oL.target.name)
      })));
  });

  document.getElementById("legend").className = null;
}

function filter() {
  const browsers = showBrowsers.checked;
  const offline = showOffline.checked;
  const substring = filterSubstring.value.toLowerCase();
  const allLocSubtreesCollapsed = !Array.from(hiddenLocSubtrees.values())
    .reduce((hidden, locs) => hidden || locs.length, false);

  if (allLocSubtreesCollapsed &&
    (!hiddenWptSubtrees.length || (hiddenWptSubtrees.length === 1 &&
      hiddenWptSubtrees[0] === "www.webpagetest.org"))) {
    collapseAll.classList.add("disabled");
  } else {
    collapseAll.classList.remove("disabled");
  }

  if (browsers) {
    browsersLabelClasses.add("active");
    offlineLabelClasses.add("disabled");
  } else {
    offlineLabelClasses.remove("disabled");
    browsersLabelClasses.remove("active");
  }
  if (offline) {
    offlineLabelClasses.add("active");
  } else {
    offlineLabelClasses.remove("active");
  }

  //Copy assignment
  hierarchyFiltered = JSON.parse(JSON.stringify(
    browsers ? browserHierarchy : hierarchyOrig));

  leafTextWidth = browsers ? browserTextWidth : agentTextWidth;

  hierarchyFiltered.Children.forEach((wpt, i, wpts) => {
    const hLS = hiddenLocSubtrees.get(wpt.Name);

    wpts[i].Children = wpt.Children.filter(loc =>
      !hiddenWptSubtrees.includes(wpt.Name) && (offline || !loc.Offline));

    wpts[i].Children.forEach((loc, j, locs) => locs[j].Children =
      loc.Children.filter(agent => !hLS.includes(loc.Name)));
  });

  hierarchyFiltered.Children = hierarchyFiltered.Children.filter(wpt =>
    wpt.Name.toLowerCase().includes(substring) ||
    wpt.Children.reduce((locIncluded, loc) => locIncluded ||
      loc.Name.toLowerCase().includes(substring) ||
      loc.Children.reduce((agentIncluded, agent) => agentIncluded ||
        agent.Name.toLowerCase().includes(substring), false), false));

  hierarchyFiltered.Children.forEach((wpt, i, wpts) => {
    wpts[i].Children = wpt.Children.filter(loc =>
      wpt.Name.toLowerCase().includes(substring) ||
      loc.Name.toLowerCase().includes(substring) ||
      loc.Children.reduce((agentIncluded, agent) => agentIncluded ||
        agent.Name.toLowerCase().includes(substring), false));

    wpts[i].Children.forEach((loc, j, locs) => locs[j].Children =
      loc.Children.filter(agent =>
        wpt.Name.toLowerCase().includes(substring) ||
        loc.Name.toLowerCase().includes(substring) ||
        agent.Name.toLowerCase().includes(substring)));
  });

  osmToLoc = new Map();
  osmNames.forEach(osm => osmToLoc[osm] = browsers ?
    osmInfo[osm].Browsers : osmInfo[osm].Locs);
  dummyRoot = d3.hierarchy(hierarchyFiltered, d => d.Children);
  dummyRoot.sort((lhs, rhs) => lhs.data.Name.localeCompare(rhs.data.Name));
  nOfWptInstances = hierarchyFiltered.Children.length;
  nOfLocations = hierarchyFiltered.Children.reduce(
    (sum, wpt) => sum + wpt.Children.length, 0);
  nOfAgents = browsers ? 0 : hierarchyFiltered.Children.reduce(
    (sum, wpt) => sum + wpt.Children.reduce(
      (agentSum, loc) => agentSum + loc.Children.length, 0), 0);
  nOfLeafs = dummyRoot.descendants().reduce(
    (sum, wpt) => sum + (wpt.children ? 0 : 1), 0);

  drawScene();
}

d3.json("getData", data => {
  osmInfo = data.OsmToInfo;
  hierarchyOrig = data.Hierarchy;
  browserHierarchy = data.BrowserHierarchy;
  osmNames = Object.keys(osmInfo);
  nOfOsmInstances = osmNames.length;

  collapse();
  window.addEventListener('resize', drawScene);
});
