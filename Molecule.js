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

// P-SEA (Labesse et al., 1997) windows as used by biotite.structure.sse
var psea = {
  rHelixLo:(89-12)*Math.PI/180, rHelixHi:(89+12)*Math.PI/180,
  aHelixLo:(50-20)*Math.PI/180, aHelixHi:(50+20)*Math.PI/180,
  d3HelixLo:4.8, d3HelixHi:5.8, d4HelixLo:5.8, d4HelixHi:7.0,
  rStrandLo:(124-14)*Math.PI/180, rStrandHi:(124+14)*Math.PI/180,
  aStrandLo:-Math.PI, aStrandMid:-125*Math.PI/180,
  aStrandHi:145*Math.PI/180, aStrandMax:Math.PI,
  d2StrandLo:6.1, d2StrandHi:7.3, d3StrandLo:9.0, d3StrandHi:10.8,
  d4StrandLo:11.3, d4StrandHi:13.5
}

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

function addRange(ranges, type, startChain, startNumber, endChain, endNumber) {
  startChain=cleanToken(startChain) || "_"; endChain=cleanToken(endChain) || startChain
  startNumber=parseInt(startNumber,10); endNumber=parseInt(endNumber,10)
  if (!isFinite(startNumber) || !isFinite(endNumber)) return
  ranges.push({type:type, startChain:startChain, startNumber:startNumber,
               endChain:endChain, endNumber:endNumber})
}

function parsePdb(text) {
  var atoms = [], ranges=[]
  var lines = String(text || "").split(/\r?\n/)
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    var record = line.substring(0, 6).trim()
    if (record === "HELIX") {
      addRange(ranges,"helix",line.substring(19,20),line.substring(21,25),line.substring(31,32),line.substring(33,37))
      continue
    }
    if (record === "SHEET") {
      addRange(ranges,"sheet",line.substring(21,22),line.substring(22,26),line.substring(32,33),line.substring(33,37))
      continue
    }
    if (record !== "ATOM" && record !== "HETATM") continue
    var alt = line.length > 16 ? line.charAt(16) : " "
    if (alt !== " " && alt !== "A" && alt !== ".") continue
    var atom = makeAtom(line.substring(30, 38), line.substring(38, 46), line.substring(46, 54),
                        line.substring(12, 16).trim(), line.substring(76, 78).trim(),
                        line.substring(21, 22).trim(), line.substring(17, 20).trim(),
                        line.substring(22, 26), record === "HETATM", line.substring(60, 66))
    if (isFinite(atom.x) && isFinite(atom.y) && isFinite(atom.z)) atoms.push(atom)
  }
  return {atoms:atoms, ranges:ranges}
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

function loopValue(headers, row, names) {
  var index=firstIndex(headers,names)
  return index >= 0 ? row[index] : ""
}

function parseCif(text) {
  var tokens = tokenizeCif(text), atoms = [], ranges=[], p = 0
  while (p < tokens.length) {
    if (tokens[p] !== "loop_") { p++; continue }
    p++
    var headers = []
    while (p < tokens.length && tokens[p].charAt(0) === "_") headers.push(tokens[p++])
    if (!headers.length) continue
    var width = headers.length
    if (headers[0].indexOf("_struct_conf.") === 0 || headers[0].indexOf("_struct_sheet_range.") === 0) {
      while (p + width <= tokens.length && tokens[p] !== "loop_" && tokens[p].charAt(0) !== "_") {
        var annotation=tokens.slice(p,p+width); p+=width
        var isHelix=headers[0].indexOf("_struct_conf.") === 0
        if (isHelix) {
          var conf=cleanToken(loopValue(headers,annotation,["_struct_conf.conf_type_id"]))
          if (conf && conf.toUpperCase().indexOf("HELX") !== 0) continue
        }
        var prefix=isHelix ? "_struct_conf." : "_struct_sheet_range."
        addRange(ranges,isHelix ? "helix" : "sheet",
          loopValue(headers,annotation,[prefix+"beg_auth_asym_id",prefix+"beg_label_asym_id"]),
          loopValue(headers,annotation,[prefix+"beg_auth_seq_id",prefix+"beg_label_seq_id"]),
          loopValue(headers,annotation,[prefix+"end_auth_asym_id",prefix+"end_label_asym_id"]),
          loopValue(headers,annotation,[prefix+"end_auth_seq_id",prefix+"end_label_seq_id"]))
      }
      continue
    }
    if (headers[0].indexOf("_atom_site.") !== 0) {
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
  }
  return {atoms:atoms, ranges:ranges}
}

function vsub(a,b){return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}}
function vadd(a,b){return {x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}}
function vscale(a,s){return {x:a.x*s,y:a.y*s,z:a.z*s}}
function vdot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z}
function vcross(a,b){return {x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}}
function vlen(a){return Math.sqrt(a.x*a.x+a.y*a.y+a.z*a.z)}
function vdist(a,b){return vlen(vsub(a,b))}
function vnorm(a){
  var l=vlen(a)
  return l>1e-8 ? {x:a.x/l,y:a.y/l,z:a.z/l} : {x:1,y:0,z:0}
}

function vangle(a,b,c){
  var u=vsub(a,b), w=vsub(c,b), lu=vlen(u), lw=vlen(w)
  if (lu<1e-8 || lw<1e-8) return NaN
  return Math.acos(Math.max(-1,Math.min(1,vdot(u,w)/(lu*lw))))
}

function vdihedral(a,b,c,d){
  var b1=vsub(b,a), b2=vsub(c,b), b3=vsub(d,c)
  var n1=vcross(b1,b2), n2=vcross(b2,b3)
  if (vlen(n1)<1e-8 || vlen(n2)<1e-8) return NaN
  n1=vnorm(n1); n2=vnorm(n2)
  var m=vcross(n1,vnorm(b2))
  return Math.atan2(vdot(m,n2), vdot(n1,n2))
}

function vrotate(v, axis, angle){
  var c=Math.cos(angle), s=Math.sin(angle), ax=vnorm(axis)
  return vadd(vadd(vscale(v,c), vscale(vcross(ax,v),s)), vscale(ax, vdot(ax,v)*(1-c)))
}

function inRange(value, lo, hi){ return value>=lo && value<=hi }

function residueGuide(res){
  if (res.atoms.CA) return res.atoms.CA
  if (res.atoms.P) return res.atoms.P
  return null
}

function collectChains(atoms){
  var byChain={}
  for (var i=0;i<atoms.length;i++) {
    var a=atoms[i]
    if (a.het) continue
    if (!byChain[a.chain]) byChain[a.chain]={}
    var rk=a.residueNumber+":"+a.residue
    if (!byChain[a.chain][rk])
      byChain[a.chain][rk]={chain:a.chain, residueNumber:a.residueNumber, residue:a.residue, atoms:{}}
    if (!byChain[a.chain][rk].atoms[a.name]) byChain[a.chain][rk].atoms[a.name]=a
  }
  var chains=[], ids=Object.keys(byChain)
  for (i=0;i<ids.length;i++) {
    var map=byChain[ids[i]], keys=Object.keys(map), list=[]
    for (var k=0;k<keys.length;k++) list.push(map[keys[k]])
    list.sort(function(p,q){
      if (p.residueNumber!==q.residueNumber) return p.residueNumber-q.residueNumber
      return p.residue<q.residue?-1:p.residue>q.residue?1:0
    })
    var fragments=[], cur=[]
    for (k=0;k<list.length;k++) {
      var guide=residueGuide(list[k])
      if (!guide) {
        if (cur.length) { fragments.push(cur); cur=[] }
        continue
      }
      if (cur.length) {
        var prev=residueGuide(cur[cur.length-1])
        var gap=(guide.name==="P" || prev.name==="P") ? 8.0 : 4.5
        if (vdist(prev,guide)>gap) { fragments.push(cur); cur=[] }
      }
      cur.push(list[k])
    }
    if (cur.length) fragments.push(cur)
    if (fragments.length) chains.push({chain:ids[i], fragments:fragments})
  }
  return chains
}

function consecutiveMask(flags, runLength){
  var n=flags.length, out=[], run=0, i, k
  for (i=0;i<n;i++) out[i]=false
  for (i=0;i<=n;i++) {
    if (i<n && flags[i]) run++
    else {
      if (run>=runLength) for (k=i-run;k<i;k++) out[k]=true
      run=0
    }
  }
  return out
}

function extendEnds(base, relaxed){
  var n=base.length, out=base.slice(), i
  for (i=0;i<n;i++) {
    if (base[i] || !relaxed[i]) continue
    if ((i>0 && base[i-1]) || (i+1<n && base[i+1])) out[i]=true
  }
  return out
}

function shortStrandContacts(ca, start, end, allCA){
  var contacts=0, i, j, d
  for (i=start;i<=end;i++) {
    if (!ca[i]) continue
    for (j=0;j<allCA.length;j++) {
      d=vdist(ca[i], allCA[j])
      if (d>4.2 && d<=5.2) contacts++
    }
  }
  return contacts>=5
}

function pseaTypes(residues, allCA){
  var n=residues.length, types=[], ca=[], i
  for (i=0;i<n;i++) {
    types[i]="coil"
    var guide=residues[i].atoms.CA
    ca[i]=(guide && aminoAcids[residues[i].residue]) ? guide : null
  }
  if (n<=5) return types

  var d2=[], d3=[], d4=[], ri=[], ai=[]
  for (i=0;i<n;i++) {
    d2[i]=d3[i]=d4[i]=ri[i]=ai[i]=NaN
    if (i>=1 && i<=n-2 && ca[i-1] && ca[i+1]) d2[i]=vdist(ca[i-1],ca[i+1])
    if (i>=1 && i<=n-3 && ca[i-1] && ca[i+2]) d3[i]=vdist(ca[i-1],ca[i+2])
    if (i>=1 && i<=n-4 && ca[i-1] && ca[i+3]) d4[i]=vdist(ca[i-1],ca[i+3])
    if (i>=1 && i<=n-2 && ca[i-1] && ca[i] && ca[i+1]) ri[i]=vangle(ca[i-1],ca[i],ca[i+1])
    if (i>=1 && i<=n-3 && ca[i-1] && ca[i] && ca[i+1] && ca[i+2]) ai[i]=vdihedral(ca[i-1],ca[i],ca[i+1],ca[i+2])
  }

  var strictH=[], relaxedH=[], strictS=[], relaxedS=[]
  for (i=0;i<n;i++) {
    var helixDist=inRange(d3[i],psea.d3HelixLo,psea.d3HelixHi) && inRange(d4[i],psea.d4HelixLo,psea.d4HelixHi)
    var helixAng=inRange(ri[i],psea.rHelixLo,psea.rHelixHi) && inRange(ai[i],psea.aHelixLo,psea.aHelixHi)
    var strandDist=inRange(d2[i],psea.d2StrandLo,psea.d2StrandHi) &&
                   inRange(d3[i],psea.d3StrandLo,psea.d3StrandHi) &&
                   inRange(d4[i],psea.d4StrandLo,psea.d4StrandHi)
    var strandAng=inRange(ri[i],psea.rStrandLo,psea.rStrandHi) &&
                  (inRange(ai[i],psea.aStrandLo,psea.aStrandMid) || inRange(ai[i],psea.aStrandHi,psea.aStrandMax))
    strictH[i]=helixDist || helixAng
    relaxedH[i]=inRange(d3[i],psea.d3HelixLo,psea.d3HelixHi) || inRange(ri[i],psea.rHelixLo,psea.rHelixHi)
    strictS[i]=strandDist || strandAng
    relaxedS[i]=inRange(d3[i],psea.d3StrandLo,psea.d3StrandHi)
  }

  var helix=extendEnds(consecutiveMask(strictH,5), relaxedH)
  var longStrand=consecutiveMask(strictS,4)
  var shortSeed=consecutiveMask(strictS,3)
  var shortStrand=[]
  for (i=0;i<n;i++) shortStrand[i]=false
  i=0
  while (i<n) {
    if (!shortSeed[i]) { i++; continue }
    var start=i
    while (i<n && shortSeed[i]) i++
    if (i-start===3 && shortStrandContacts(ca,start,i-1,allCA))
      for (var k=start;k<i;k++) shortStrand[k]=true
  }
  var mergedStrand=[]
  for (i=0;i<n;i++) mergedStrand[i]=longStrand[i]||shortStrand[i]
  var strand=extendEnds(mergedStrand, relaxedS)

  for (i=0;i<n;i++) {
    if (helix[i]) types[i]="helix"
    if (strand[i]) types[i]="sheet"
  }
  return types
}

function applyFileRanges(atoms, ranges){
  for (var i=0;i<atoms.length;i++) {
    var atom=atoms[i], type="coil"
    if (!atom.het) {
      for (var j=0;j<ranges.length;j++) {
        var range=ranges[j]
        if (atom.chain === range.startChain && atom.chain === range.endChain &&
            atom.residueNumber >= range.startNumber && atom.residueNumber <= range.endNumber) {
          type=range.type
          if (type === "helix") break
        }
      }
    }
    atom.secondary=type
  }
}

function applyGeometricSecondaryStructure(atoms){
  var chains=collectChains(atoms), allCA=[], c, f, r, i, frag
  for (c=0;c<chains.length;c++) {
    for (f=0;f<chains[c].fragments.length;f++) {
      frag=chains[c].fragments[f]
      for (r=0;r<frag.length;r++) {
        if (frag[r].atoms.CA && aminoAcids[frag[r].residue]) allCA.push(frag[r].atoms.CA)
      }
    }
  }
  for (c=0;c<chains.length;c++) {
    for (f=0;f<chains[c].fragments.length;f++) {
      frag=chains[c].fragments[f]
      var types=pseaTypes(frag, allCA)
      for (r=0;r<frag.length;r++) {
        if (types[r]==="coil") continue
        var names=Object.keys(frag[r].atoms)
        for (i=0;i<names.length;i++) {
          var atom=frag[r].atoms[names[i]]
          if (atom.secondary==="coil") atom.secondary=types[r]
        }
      }
    }
  }
}

function assignSecondaryStructure(atoms,ranges) {
  applyFileRanges(atoms, ranges || [])
  applyGeometricSecondaryStructure(atoms)
  var counts={helix:0,sheet:0,coil:0}, seen={}
  for (var i=0;i<atoms.length;i++) {
    var atom=atoms[i]
    var key=atom.chain+":"+atom.residueNumber+":"+atom.residue
    if (!atom.het && !seen[key]) { seen[key]=true; counts[atom.secondary]++ }
  }
  return counts
}

function catmullRom(p0,p1,p2,p3,t){
  var t2=t*t, t3=t2*t
  return {
    x:0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y:0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
    z:0.5*((2*p1.z)+(-p0.z+p2.z)*t+(2*p0.z-5*p1.z+4*p2.z-p3.z)*t2+(-p0.z+3*p1.z-3*p2.z+p3.z)*t3)
  }
}

function transportNormal(prevT, nextT, prevN){
  var axis=vcross(prevT,nextT), axisLen=vlen(axis)
  if (axisLen<1e-6) {
    var n=vsub(prevN, vscale(nextT, vdot(prevN,nextT)))
    return vlen(n)>1e-6 ? vnorm(n) : prevN
  }
  var angle=Math.acos(Math.max(-1,Math.min(1,vdot(prevT,nextT))))
  var moved=vrotate(prevN, axis, angle)
  moved=vsub(moved, vscale(nextT, vdot(moved,nextT)))
  return vlen(moved)>1e-6 ? vnorm(moved) : prevN
}

function profileFor(ss){
  if (ss==="helix") return {a:1.22, b:0.40, sides:8}
  if (ss==="sheet") return {a:1.12, b:0.18, sides:8}
  return {a:0.32, b:0.32, sides:8}
}

function peptideHint(res){
  if (!res.atoms.C || !res.atoms.O) return null
  var hint=vsub(res.atoms.O, res.atoms.C)
  return vlen(hint)>0.4 ? vnorm(hint) : null
}

function addQuad(faces,a,b,c,d,atom,ss){
  var n=vcross(vsub(b,a), vsub(d,a)), ln=vlen(n)
  if (ln<1e-8) { n=vcross(vsub(c,b), vsub(a,b)); ln=vlen(n) }
  if (ln<1e-8) return
  faces.push({
    x0:a.x,y0:a.y,z0:a.z, x1:b.x,y1:b.y,z1:b.z, x2:c.x,y2:c.y,z2:c.z, x3:d.x,y3:d.y,z3:d.z,
    nx:n.x/ln,ny:n.y/ln,nz:n.z/ln, tri:false, atom:atom, secondary:ss
  })
}

function addTri(faces,a,b,c,atom,ss){
  var n=vcross(vsub(b,a), vsub(c,a)), ln=vlen(n)
  if (ln<1e-8) return
  faces.push({
    x0:a.x,y0:a.y,z0:a.z, x1:b.x,y1:b.y,z1:b.z, x2:c.x,y2:c.y,z2:c.z, x3:c.x,y3:c.y,z3:c.z,
    nx:n.x/ln,ny:n.y/ln,nz:n.z/ln, tri:true, atom:atom, secondary:ss
  })
}

function profileRing(p,n,bin,a,b,sides){
  var ring=[]
  for (var s=0;s<sides;s++) {
    var ang=s*2*Math.PI/sides, ca=Math.cos(ang), sa=Math.sin(ang)
    ring.push({
      x:p.x+n.x*a*ca+bin.x*b*sa,
      y:p.y+n.y*a*ca+bin.y*b*sa,
      z:p.z+n.z*a*ca+bin.z*b*sa
    })
  }
  return ring
}

function stitchRings(faces,r0,r1,atom,ss){
  if (!r0 || !r1 || r0.length!==r1.length) return
  for (var s=0;s<r0.length;s++) {
    var s2=(s+1)%r0.length
    addQuad(faces, r0[s], r0[s2], r1[s2], r1[s], atom, ss)
  }
}

function capRing(faces,ring,tip,atom,ss){
  for (var s=0;s<ring.length;s++) addTri(faces, ring[s], ring[(s+1)%ring.length], tip, atom, ss)
}

function sampleFragment(residues, samples){
  var n=residues.length, guides=[]
  for (var i=0;i<n;i++) {
    var res=residues[i], g=residueGuide(res)
    guides.push({
      x:g.x,y:g.y,z:g.z,
      atom:g,
      ss:g.secondary || "coil",
      hint:peptideHint(res)
    })
  }
  var prevHint=null
  for (i=0;i<n;i++) {
    if (!guides[i].hint) continue
    if (prevHint && vdot(guides[i].hint, prevHint)<0) guides[i].hint=vscale(guides[i].hint,-1)
    prevHint=guides[i].hint
  }

  var stations=[]
  for (i=0;i<n-1;i++) {
    var p0=guides[Math.max(0,i-1)], p1=guides[i], p2=guides[i+1], p3=guides[Math.min(n-1,i+2)]
    var count=(i===n-2) ? samples+1 : samples
    for (var s=0;s<count;s++) {
      var t=s/samples
      var ss=(t<0.5) ? p1.ss : p2.ss
      var atom=(t<0.5) ? p1.atom : p2.atom
      var hint=(t<0.5) ? p1.hint : p2.hint
      stations.push({p:catmullRom(p0,p1,p2,p3,t), ss:ss, atom:atom, hint:hint})
    }
  }
  return stations
}

function orientStations(stations){
  var n=stations.length, i
  if (n<2) return
  for (i=0;i<n;i++) {
    var prev=stations[Math.max(0,i-1)].p, next=stations[Math.min(n-1,i+1)].p
    var tang=vsub(next,prev)
    if (i===0) tang=vsub(stations[1].p, stations[0].p)
    if (i===n-1) tang=vsub(stations[n-1].p, stations[n-2].p)
    stations[i].t=vlen(tang)>1e-6 ? vnorm(tang) : {x:1,y:0,z:0}
  }
  var t0=stations[0].t
  var ref=Math.abs(t0.y)<0.85 ? {x:0,y:1,z:0} : {x:1,y:0,z:0}
  stations[0].n=vnorm(vcross(t0, ref))
  for (i=1;i<n;i++) stations[i].n=transportNormal(stations[i-1].t, stations[i].t, stations[i-1].n)

  for (i=0;i<n;i++) {
    var st=stations[i]
    if (st.ss==="helix" && i>0 && i<n-1) {
      var inward=vadd(vsub(stations[i-1].p, st.p), vsub(stations[i+1].p, st.p))
      inward=vsub(inward, vscale(st.t, vdot(inward, st.t)))
      if (vlen(inward)>0.05) {
        inward=vnorm(inward)
        if (vdot(inward, st.n)<0) inward=vscale(inward,-1)
        st.n=vnorm(vadd(vscale(st.n,0.28), vscale(inward,0.72)))
      }
    }
    if (st.ss==="sheet" && st.hint) {
      var w=vsub(st.hint, vscale(st.t, vdot(st.hint, st.t)))
      if (vlen(w)>0.15) {
        w=vnorm(w)
        if (vdot(w, st.n)<0) w=vscale(w,-1)
        st.n=vnorm(vadd(vscale(st.n,0.22), vscale(w,0.78)))
      }
    }
    st.bin=vnorm(vcross(st.t, st.n))
    st.n=vnorm(vcross(st.bin, st.t))
  }
}

function stationProfile(stations, i){
  var p=profileFor(stations[i].ss), a=p.a, b=p.b, q
  if (i>0 && stations[i-1].ss!==stations[i].ss) {
    q=profileFor(stations[i-1].ss)
    a=a*0.55+q.a*0.45; b=b*0.55+q.b*0.45
  }
  if (i+1<stations.length && stations[i+1].ss!==stations[i].ss) {
    q=profileFor(stations[i+1].ss)
    a=a*0.55+q.a*0.45; b=b*0.55+q.b*0.45
  }
  return {a:a, b:b, sides:p.sides, ss:stations[i].ss}
}

function sheetRunEnd(stations, i){
  var j=i
  while (j+1<stations.length && stations[j+1].ss==="sheet") j++
  return j
}

function isArrowBase(stations, i, samples){
  if (stations[i].ss!=="sheet") return false
  var start=i
  while (start>0 && stations[start-1].ss==="sheet") start--
  var end=sheetRunEnd(stations, i)
  var len=end-start+1
  if (len<samples+3) return false
  return i===end-Math.min(samples, Math.max(2, Math.floor(len/3)))
}

function meshFragment(residues, samples, faces, sides){
  if (residues.length<2) return
  var stations=sampleFragment(residues, samples)
  if (stations.length<2) return
  orientStations(stations)
  sides=sides||8
  var endedWithArrow=false
  function ringAt(i, scaleA, scaleB){
    var pr=stationProfile(stations,i)
    return profileRing(stations[i].p, stations[i].n, stations[i].bin, pr.a*(scaleA||1), pr.b*(scaleB||1), sides)
  }
  var skip=0, i
  for (i=0;i<stations.length-1;i++) {
    if (i<skip) continue
    if (isArrowBase(stations,i,samples)) {
      var tip=sheetRunEnd(stations,i)
      capRing(faces, ringAt(i,1.62,1.08), stations[tip].p, stations[tip].atom, "sheet")
      skip=tip+1
      endedWithArrow=tip===stations.length-1
      continue
    }
    stitchRings(faces, ringAt(i), ringAt(i+1), stations[i].atom, stations[i].ss)
    endedWithArrow=false
  }
  capRing(faces, ringAt(0), stations[0].p, stations[0].atom, stations[0].ss)
  if (!endedWithArrow)
    capRing(faces, ringAt(stations.length-1), stations[stations.length-1].p,
            stations[stations.length-1].atom, stations[stations.length-1].ss)
}

function buildCartoonGeometry(atoms){
  var chains=collectChains(atoms), faces=[], guides=0, c, f
  for (c=0;c<chains.length;c++)
    for (f=0;f<chains[c].fragments.length;f++)
      guides+=chains[c].fragments[f].length
  var samples=guides>1800?3:guides>800?5:8
  var sides=guides>1800?6:guides>600?8:10
  for (c=0;c<chains.length;c++)
    for (f=0;f<chains[c].fragments.length;f++)
      meshFragment(chains[c].fragments[f], samples, faces, sides)
  return faces
}

function summarize(atoms,ranges) {
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
  var secondary=assignSecondaryStructure(atoms,ranges || [])
  return {atoms:atoms, atomCount:atoms.length, chainCount:Object.keys(chains).length,
          residueCount:Object.keys(residues).length, polymerCount:polymer, ligandCount:ligands,
          secondary:secondary, radius:radius, cartoon:buildCartoonGeometry(atoms)}
}

function parse(text, fileName) {
  var lower=String(fileName || "").toLowerCase()
  var parsed=(lower.endsWith(".cif") || lower.endsWith(".mmcif") || /^\s*data_/m.test(text)) ? parseCif(text) : parsePdb(text)
  return summarize(parsed.atoms,parsed.ranges)
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
