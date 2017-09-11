package main

type wptServer struct {
	BaseURL string
	Label   string
}

type osmTargets struct {
	Target []struct {
		Active                    bool
		Location                  string
		UniqueIdentifierForServer string
		WptServer                 wptServer
	}
}

type osmInfo struct {
	Wpts     []string
	Locs     []string
	Browsers []string
	URL      string
	Err      bool
}

type testerHierarchy struct {
	Name      string
	LastCheck uint
	LastWork  uint
}

type locHierarchy struct {
	Name     string
	Offline  bool
	Children []testerHierarchy
}

type wptHierarchy struct {
	URL      string
	Name     string
	Err      bool
	Children []locHierarchy
}

type hierarchy struct {
	Children []wptHierarchy
}

type getTesters struct {
	Location []struct {
		Status string `xml:"status"`
		ID     string `xml:"id"`
		Tester []struct {
			ID        string `xml:"id"`
			LastCheck uint   `xml:"elapsed"`
			LastWork  uint   `xml:"last"`
		} `xml:"testers>tester"`
	} `xml:"data>location"`
}
