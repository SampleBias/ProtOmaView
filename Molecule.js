.pragma library

var aminoAcids = {
  ALA:1, ARG:1, ASN:1, ASP:1, CYS:1, GLN:1, GLU:1, GLY:1, HIS:1, ILE:1,
  LEU:1, LYS:1, MET:1, PHE:1, PRO:1, SER:1, THR:1, TRP:1, TYR:1, VAL:1,
  ASX:1, GLX:1, SEC:1, PYL:1
}

var elementColors = {
  H:"#d9d9d9", C:"#9aa4b2", N:"#5b8cff", O:"#ff5c68", S:"#ffd34d",
  P:"#ff9f43", F:"#5ee37d", CL:"#5ee37d", BR:"#a85d36", I:"#8c5bd6",
  FE:"#e38b47", CA:"#75d4d1", MG:"#7bd76b", ZN:"#a5a7d8"
}

var chainPalette = ["#6ee7ff", "#ff7a90", "#ffd166", "#8be28b", "#bd93f9", "#ff9f68", "#63d6a3", "#f58ad4"]

function cleanToken(value) {
  if (value === undefined || value === null || value === "." || value === "?") return ""
  return String(value)
}

function inferElement(atomName) {
  var name = String(atomName || "").replace(/[^A-Za-z]/g, "").toUpperCase()
  if (name.length > 1 && elementColors[name.substring(0, 2)]) return name.substring(0, 2)
  return name.length ? name.charAt(0) : "C"
}

function makeAtom(x, y, z, name, element, chain, residue, residueNumber, het, bfactor) {
  return {
    x:Number(x), y:Number(y), z:Number(z), name:cleanToken(name).toUpperCase(),
    element:(cleanToken(element) || inferElement(name)).toUpperCase(),
    chain:cleanToken(chain) || "_", residue:cleanToken(residue).toUpperCase() || "UNK",
    residueNumber:parseInt(residueNumber, 10) || 0, het:!!het,
    bfactor:isFinite(Number(bfactor)) ? Number(bfactor) : 0
  }
}

function parsePdb(text) {
  var atoms = []
  var lines = String(text || "").split(/\r?\n/)
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    var record = line.substring(0, 6).trim()
    if (record !== "ATOM" && record !== "HETATM") continue
    var alt = line.length > 16 ? line.charAt(16) : " "
    if (alt !== " " && alt !== "A" && alt !== ".") continue
    var atom = makeAtom(line.substring(30, 38), line.substring(38, 46), line.substring(46, 54),
                        line.substring(12, 16).trim(), line.substring(76, 78).trim(),
                        line.substring(21, 22).trim(), line.substring(17, 20).trim(),
                        line.substring(22, 26), record === "HETATM", line.substring(60, 66))
    if (isFinite(atom.x) && isFinite(atom.y) && isFinite(atom.z)) atoms.push(atom)
  }
  return atoms
}

function tokenizeCif(text) {
  var tokens = []
  var lines = String(text || "").split(/\r?\n/)
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li]
    if (line.charAt(0) === ";") {
      var block = []
      li++
      while (li < lines.length && lines[li].charAt(0) !== ";") { block.push(lines[li]); li++ }
      tokens.push(block.join("\n"))
      continue
    }
    var current = "", quote = ""
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i)
      if (!quote && c === "#" && current.length === 0) break
      if (quote) {
        if (c === quote) { tokens.push(current); current = ""; quote = "" }
        else current += c
      } else if (c === "'" || c === '"') {
        if (current.length) { tokens.push(current); current = "" }
        quote = c
      } else if (/\s/.test(c)) {
        if (current.length) { tokens.push(current); current = "" }
      } else current += c
    }
    if (current.length) tokens.push(current)
  }
  return tokens
}

function firstIndex(headers, names) {
  for (var i = 0; i < names.length; i++) {
    var index = headers.indexOf(names[i])
    if (index >= 0) return index
  }
  return -1
}

function parseCif(text) {
  var tokens = tokenizeCif(text), atoms = [], p = 0
  while (p < tokens.length) {
    if (tokens[p] !== "loop_") { p++; continue }
    p++
    var headers = []
    while (p < tokens.length && tokens[p].charAt(0) === "_") headers.push(tokens[p++])
    if (!headers.length || headers[0].indexOf("_atom_site.") !== 0) {
      while (p < tokens.length && tokens[p] !== "loop_" && tokens[p].charAt(0) !== "_") p++
      continue
    }
    var ix = firstIndex(headers, ["_atom_site.Cartn_x"])
    var iy = firstIndex(headers, ["_atom_site.Cartn_y"])
    var iz = firstIndex(headers, ["_atom_site.Cartn_z"])
    var iname = firstIndex(headers, ["_atom_site.auth_atom_id", "_atom_site.label_atom_id"])
    var ielement = firstIndex(headers, ["_atom_site.type_symbol"])
    var ichain = firstIndex(headers, ["_atom_site.auth_asym_id", "_atom_site.label_asym_id"])
    var ires = firstIndex(headers, ["_atom_site.auth_comp_id", "_atom_site.label_comp_id"])
    var inum = firstIndex(headers, ["_atom_site.auth_seq_id", "_atom_site.label_seq_id"])
    var igroup = firstIndex(headers, ["_atom_site.group_PDB"])
    var ib = firstIndex(headers, ["_atom_site.B_iso_or_equiv"])
    var ialt = firstIndex(headers, ["_atom_site.label_alt_id", "_atom_site.auth_alt_id"])
    if (ix < 0 || iy < 0 || iz < 0 || iname < 0) throw new Error("mmCIF atom coordinates are incomplete")
    var width = headers.length
    while (p + width <= tokens.length && tokens[p] !== "loop_" && tokens[p].charAt(0) !== "_") {
      var row = tokens.slice(p, p + width); p += width
      var alt = ialt >= 0 ? cleanToken(row[ialt]) : ""
      if (alt && alt !== "A" && alt !== "1") continue
      var atom = makeAtom(row[ix], row[iy], row[iz], row[iname], ielement >= 0 ? row[ielement] : "",
                          ichain >= 0 ? row[ichain] : "", ires >= 0 ? row[ires] : "",
                          inum >= 0 ? row[inum] : 0, igroup >= 0 && row[igroup] === "HETATM",
                          ib >= 0 ? row[ib] : 0)
      if (isFinite(atom.x) && isFinite(atom.y) && isFinite(atom.z)) atoms.push(atom)
    }
    if (atoms.length) return atoms
  }
  return atoms
}

function summarize(atoms) {
  if (!atoms.length) throw new Error("No atoms found in this structure")
  var sx=0, sy=0, sz=0, chains={}, residues={}, polymer=0, ligands=0
  for (var i=0; i<atoms.length; i++) {
    var a=atoms[i]; sx+=a.x; sy+=a.y; sz+=a.z; chains[a.chain]=true
    residues[a.chain+":"+a.residueNumber+":"+a.residue]=true
    if (a.het) ligands++; else polymer++
  }
  var center={x:sx/atoms.length, y:sy/atoms.length, z:sz/atoms.length}, radius=1
  for (i=0; i<atoms.length; i++) {
    a=atoms[i]; a.x-=center.x; a.y-=center.y; a.z-=center.z
    radius=Math.max(radius, Math.sqrt(a.x*a.x+a.y*a.y+a.z*a.z))
  }
  return {atoms:atoms, atomCount:atoms.length, chainCount:Object.keys(chains).length,
          residueCount:Object.keys(residues).length, polymerCount:polymer, ligandCount:ligands, radius:radius}
}

function parse(text, fileName) {
  var lower=String(fileName || "").toLowerCase()
  var atoms=(lower.endsWith(".cif") || lower.endsWith(".mmcif") || /^\s*data_/m.test(text)) ? parseCif(text) : parsePdb(text)
  return summarize(atoms)
}

function color(atom, scheme, chainMap) {
  if (scheme === "element") return elementColors[atom.element] || "#d8dee9"
  if (scheme === "chain") return chainPalette[chainMap[atom.chain] % chainPalette.length]
  if (scheme === "bfactor") {
    var t=Math.max(0, Math.min(1, atom.bfactor/100))
    return Qt.rgba(0.2+0.8*t, 0.65-0.42*t, 1.0-0.75*t, 1)
  }
  if (atom.name === "CA" && aminoAcids[atom.residue]) return "#70e1a1"
  if (atom.het) return elementColors[atom.element] || "#ffd166"
  return "#69b7ff"
}
