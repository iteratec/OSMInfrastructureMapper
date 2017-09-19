package main

import (
	"crypto/tls"
	"encoding/json"
	"encoding/xml"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func calcData(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if r := recover(); r != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError),
				http.StatusInternalServerError)
		}
	}()

	osmServers := strings.Split(os.Getenv("OSMIM_OSM_SERVERS"), " ")
	osmToInfo := make(map[string]osmInfo)
	wptURLsToLabels := make(map[string][]string)
	wptURLsToBrowsers := make(map[string][]string)

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	c := &http.Client{Timeout: 10 * time.Second, Transport: tr}

	for _, s := range osmServers {
		if s != "" {
			var targets osmTargets

			osm := strings.TrimSuffix(strings.TrimPrefix(strings.TrimPrefix(s,
				"http://"), "https://"), "/")
			restURL := strings.TrimSuffix(s, "/") + "/rest/allLocations"
			locations, err := c.Get(restURL)
			if err != nil {
				log.Print("Error on get request to " + restURL + "\nError: ")
				log.Print(err)
				osmToInfo[osm] = osmInfo{Wpts: []string{}, Locs: []string{},
					Browsers: []string{}, URL: s, Err: true}
				continue
			}
			defer locations.Body.Close()
			err = json.NewDecoder(locations.Body).Decode(&targets)
			if err != nil {
				log.Print("Error when decoding " + restURL + "\nError: ")
				log.Print(err)
				osmToInfo[osm] = osmInfo{Wpts: []string{}, Locs: []string{},
					Browsers: []string{}, URL: s, Err: true}
				continue
			}

			//Eliminating duplicate baseURLs by adding them to this map
			wptURLs := make(map[wptServer]bool)
			locs, wpts, browsers := []string{}, []string{}, []string{}
			for _, t := range targets.Target {
				if t.Active {
					wptURLs[t.WptServer] = true
					locs = append(locs, t.Location)
					browsers = append(browsers, t.UniqueIdentifierForServer)
					wptURLsToBrowsers[t.WptServer.BaseURL] =
						append(wptURLsToBrowsers[t.WptServer.BaseURL],
							t.UniqueIdentifierForServer)
				}
			}
			for w := range wptURLs {
				wpts = append(wpts, w.BaseURL)
				wptURLsToLabels[w.BaseURL] = append(wptURLsToLabels[w.BaseURL], w.Label)
			}
			osmToInfo[osm] = osmInfo{Wpts: wpts, Locs: locs, Browsers: browsers,
				URL: s, Err: false}
		}
	}

	h, bH := hierarchy{Children: []wptHierarchy{}},
		hierarchy{Children: []wptHierarchy{}}
	for wpt := range wptURLsToLabels {
		var testers getTesters

		shortestLabel := wptURLsToLabels[wpt][0]
		for _, l := range wptURLsToLabels[wpt] {
			if len(l) < len(shortestLabel) {
				shortestLabel = l
			}
		}
		wptH := wptHierarchy{URL: wpt, Name: shortestLabel, Err: true}

		restURL := strings.TrimSuffix(wpt, "/") + "/getTesters.php"
		testersXML, err := c.Get(restURL)
		if err != nil {
			log.Print("Error on get request to " + restURL + "\nError: ")
			log.Print(err)
			h.Children = append(h.Children, wptH)
			bH.Children = append(bH.Children, wptH)
			continue
		}
		defer testersXML.Body.Close()
		err = xml.NewDecoder(testersXML.Body).Decode(&testers)
		if err != nil {
			log.Print("Error when decoding " + restURL + "\nError: ")
			log.Print(err)
			h.Children = append(h.Children, wptH)
			bH.Children = append(bH.Children, wptH)
			continue
		}

		wptH.Err = false
		bWptH := wptH
		for _, b := range wptURLsToBrowsers[wpt] {
			bWptH.Children = append(bWptH.Children,
				locHierarchy{Name: b, Children: []testerHierarchy{}})
		}
		bH.Children = append(bH.Children, bWptH)

		for _, l := range testers.Location {
			locH := locHierarchy{
				Name: l.ID, Offline: false, Children: []testerHierarchy{}}
			if l.Status == "OK" {
				for _, t := range l.Tester {
					locH.Children = append(locH.Children, testerHierarchy{Name: t.ID,
						LastCheck: t.LastCheck, LastWork: t.LastWork})
				}
			} else if l.Status == "OFFLINE" {
				locH.Offline = true
			} else {
				continue
			}
			wptH.Children = append(wptH.Children, locH)
		}
		h.Children = append(h.Children, wptH)
	}

	json.NewEncoder(w).Encode(struct {
		OsmToInfo        map[string]osmInfo
		Hierarchy        hierarchy
		BrowserHierarchy hierarchy
	}{
		osmToInfo,
		h,
		bH,
	})
}

func main() {
	http.Handle("/", http.FileServer(http.Dir("./static")))
	http.HandleFunc("/getData", calcData)
	log.Fatal(http.ListenAndServe(":80", nil))
}
