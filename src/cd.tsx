import { List, ActionPanel, Action, showToast, Toast, Icon, getPreferenceValues } from "@raycast/api";
import { useMemo, useState } from "react";
import { useFetch } from "@raycast/utils";

type CardinalResult = {
  path: string;
  metadata?: {
    size: number;
    mtime: number;
    type: number;
  };
};

type CardinalResponse = {
  results: CardinalResult[];
  highlights: string[];
};

interface Preferences {
  endpoint: string;
}

type SortKey = "filename" | "fullPath" | "size" | "mtime" | "ctime";
type SortDirection = "asc" | "desc";

function normalizeEndpoint(endpoint: string) {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  if (bytes < 0) return "";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const endpoint = useMemo(() => normalizeEndpoint(preferences.endpoint), [preferences.endpoint]);

  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("filename");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const limit = 50;
  const offset = (page - 1) * limit;
  const query = useMemo(() => searchText, [searchText]);

  const { data, isLoading } = useFetch<CardinalResponse>(`${endpoint}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: limit,
      offset: offset,
      sort: {
        key: sortKey,
        direction: sortDir,
      },
      options: { caseInsensitive: true },
    }),
    execute: query.length > 0,
    keepPreviousData: true,
    onError: (error) => {
      showToast({
        style: Toast.Style.Failure,
        title: "Cardinal API Error",
        message: String(error),
      });
    },
  });

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    const [key, dir] = value.split("_");
    setSortKey(key as SortKey);
    setSortDir(dir as SortDirection);
    setPage(1);
  };

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={handleSearchTextChange}
      searchBarPlaceholder="Search files with Cardinal..."
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Sort By" value={`${sortKey}_${sortDir}`} onChange={handleSortChange}>
          <List.Dropdown.Item title="Name (A-Z)" value="filename_asc" />
          <List.Dropdown.Item title="Name (Z-A)" value="filename_desc" />
          <List.Dropdown.Item title="Size (Largest)" value="size_desc" />
          <List.Dropdown.Item title="Size (Smallest)" value="size_asc" />
          <List.Dropdown.Item title="Newest" value="mtime_desc" />
          <List.Dropdown.Item title="Oldest" value="mtime_asc" />
        </List.Dropdown>
      }
    >
      {page > 1 && (
        <List.Item
          title="Previous Page"
          icon={Icon.ArrowLeftCircle}
          actions={
            <ActionPanel>
              <Action title="Previous Page" onAction={() => setPage(page - 1)} />
            </ActionPanel>
          }
        />
      )}

      {data?.results.map((item) => (
        <List.Item
          key={item.path}
          title={item.path.split("/").pop() || ""}
          subtitle={item.path}
          icon={{ fileIcon: item.path }}
          actions={
            <ActionPanel>
              <Action.Open title="Open File" target={item.path} />
              <Action.ShowInFinder path={item.path} />
              <Action.CopyToClipboard
                title="Copy Path"
                content={item.path}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
              <ActionPanel.Section title="Sort">
                <ActionPanel.Submenu title="Sort by…" icon={Icon.ArrowDown}>
                  <Action
                    title="Name (A-Z)"
                    onAction={() => handleSortChange("filename_asc")}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
                  />
                  <Action
                    title="Size (Largest)"
                    onAction={() => handleSortChange("size_desc")}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
                  />
                  <Action
                    title="Date (Newest)"
                    onAction={() => handleSortChange("mtime_desc")}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
                  />
                </ActionPanel.Submenu>
              </ActionPanel.Section>
            </ActionPanel>
          }
          accessories={[
            {
              text: item.metadata ? formatBytes(item.metadata.size) : "",
              tooltip: item.metadata?.mtime ? new Date(item.metadata.mtime * 1000).toLocaleString() : undefined,
            },
          ]}
        />
      ))}

      {data && data.results.length === limit && (
        <List.Item
          title="Next Page"
          icon={Icon.ArrowRightCircle}
          actions={
            <ActionPanel>
              <Action title="Next Page" onAction={() => setPage(page + 1)} />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
