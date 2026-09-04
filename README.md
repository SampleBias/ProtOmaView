# ProtOmaView

An Omarchy Quattro overlay for opening and exploring protein structures locally. Drop a PDB or mmCIF file onto the viewer, or choose one with the file picker. No structure data leaves your machine.

## Features

- PDB, ENT, CIF, and mmCIF input
- Drag-and-drop and an in-overlay file browser
- Interactive mouse rotation and wheel zoom
- Backbone, atom, and wireframe views
- Chain, element, and B-factor coloring
- Ligand display and basic structure statistics
- Pure QML/JavaScript: no build step or runtime dependency beyond Omarchy Quattro
- Toolbar widget for opening and closing the viewer with one click

## Install

```sh
omarchy plugin add https://github.com/SampleBias/ProtOmaView.git --enable
```

## Open

After enabling the plugin, place its widget on the bar:

```sh
omarchy bar put io.github.samplebias.protomaview --section right
```

Click the **P** button in the toolbar to open or close the viewer. You can also summon it from a terminal:

```sh
omarchy-shell shell summon io.github.samplebias.protomaview '{}'
```

You can also open a structure directly:

```sh
omarchy-shell shell summon io.github.samplebias.protomaview '{"path":"/absolute/path/to/structure.cif"}'
```

## Controls

| Control | Action |
| --- | --- |
| Drag | Rotate |
| Mouse wheel | Zoom |
| `M` | Cycle render mode |
| `C` | Cycle color scheme |
| `R` | Reset camera |
| `Ctrl+O` | Open file picker |
| `Esc` | Close |

## Development

Validate the repository before installation:

```sh
omarchy plugin validate .
qmllint -I "$OMARCHY_PATH/shell" ProtOmaView.qml
```

After installation, saved changes under `~/.config/omarchy/plugins/` hot-reload. The plugin runs inside the Omarchy shell with your user permissions and reads only the structure path you select or pass in the summon payload.

## License

MIT
