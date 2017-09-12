# OSMIM - OpenSpeedMonitor Infrastructure Mapper

OSMIM visualizes relationships between
[osm](https://github.com/iteratec/OpenSpeedMonitor) and wpt instances together
with their test locations and agents in a graph structure.

## How to run

Set the environment variable `OSMIM_OSM_SERVERS` to a list of space-separated
osm instances. For example:
`OSMIM_OSM_SERVERS="http://my.osm.instance1.org http://my.osm.instance2.com"`

Start the server via `go run *.go`, use the provided `Dockerfile` or the
[automated build](https://hub.docker.com/r/iteratec/osminfrastructuremapper/)
on Docker Hub.

The server runs on port 80.

## Features

Uses ECMAScript 2016

Colors inspired from [here](https://github.com/iteratec/OpenSpeedMonitor/blob/master/grails-app/assets/stylesheets/variables-corporate.less)

Uses karmilla-regular font. Which is the same font that is also used on the website https://www.iteratec.de.
