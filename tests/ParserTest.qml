import QtQuick
import "../Molecule.js" as Molecule

QtObject {
  function check(condition, message) {
    if (!condition) throw new Error(message)
  }

  Component.onCompleted: {
    var pdb = [
      "HELIX    1   1 GLY A    1  GLY A    1  1                                   1",
      "ATOM      1  N   GLY A   1      11.104  13.207   9.100  1.00 20.00           N  ",
      "ATOM      2  CA  GLY A   1      12.000  12.100   9.400  1.00 21.00           C  ",
      "HETATM    3  O   HOH B   2      14.000  11.000   8.000  1.00 30.00           O  "
    ].join("\n")
    var p = Molecule.parse(pdb, "tiny.pdb")
    check(p.atomCount === 3, "PDB atom count")
    check(p.chainCount === 2, "PDB chain count")
    check(p.residueCount === 2, "PDB residue count")
    check(p.ligandCount === 1, "PDB ligand count")
    check(p.atoms[0].secondary === "helix", "PDB HELIX assignment")
    check(p.secondary.helix === 1, "PDB helix residue count")

    var cif = [
      "data_tiny", "#", "loop_",
      "_struct_sheet_range.sheet_id", "_struct_sheet_range.id",
      "_struct_sheet_range.beg_auth_asym_id", "_struct_sheet_range.beg_auth_seq_id",
      "_struct_sheet_range.end_auth_asym_id", "_struct_sheet_range.end_auth_seq_id",
      "A 1 A 1 A 1", "#", "loop_",
      "_atom_site.group_PDB", "_atom_site.id", "_atom_site.type_symbol",
      "_atom_site.label_atom_id", "_atom_site.label_alt_id", "_atom_site.label_comp_id",
      "_atom_site.auth_asym_id", "_atom_site.auth_seq_id",
      "_atom_site.Cartn_x", "_atom_site.Cartn_y", "_atom_site.Cartn_z", "_atom_site.B_iso_or_equiv",
      "ATOM 1 N N . GLY A 1 1.0 2.0 3.0 12.0",
      "ATOM 2 C CA . GLY A 1 2.0 2.5 3.2 14.0",
      "HETATM 3 ZN ZN . ZN B 2 5.0 4.0 1.0 22.0", "#"
    ].join("\n")
    var c = Molecule.parse(cif, "tiny.cif")
    check(c.atomCount === 3, "mmCIF atom count")
    check(c.chainCount === 2, "mmCIF chain count")
    check(c.ligandCount === 1, "mmCIF ligand count")
    check(c.atoms[0].secondary === "sheet", "mmCIF sheet assignment")
    check(c.secondary.sheet === 1, "mmCIF sheet residue count")

    function padInt(n, w) {
      var s=String(n)
      while (s.length<w) s=" "+s
      return s
    }
    function padNum(n, w) {
      var s=Number(n).toFixed(3)
      while (s.length<w) s=" "+s
      return s
    }
    function caAtom(serial, resn, x, y, z) {
      return "ATOM  "+padInt(serial,5)+"  CA  ALA A"+padInt(resn,4)+"    "+padNum(x,8)+padNum(y,8)+padNum(z,8)+"  1.00 20.00           C  "
    }

    var helixLines=[]
    for (var i=0;i<12;i++) {
      var th=i*100*Math.PI/180
      helixLines.push(caAtom(i+1, i+1, 2.3*Math.cos(th), 2.3*Math.sin(th), i*1.5))
    }
    var h = Molecule.parse(helixLines.join("\n"), "helix.pdb")
    check(h.secondary.helix >= 5, "geometric helix assignment")
    check(h.cartoon && h.cartoon.length > 20, "helix cartoon mesh")
    var helixFaces=0
    for (i=0;i<h.cartoon.length;i++) if (h.cartoon[i].secondary === "helix") helixFaces++
    check(helixFaces > 0, "helix cartoon faces")
    check(h.cartoon[0].atom && h.cartoon[0].atom.name === "CA", "cartoon face atom")

    var strandLines=[]
    for (i=0;i<8;i++) strandLines.push(caAtom(i+1, i+1, (i%2===0)?0.85:-0.85, 0, i*3.3))
    var s = Molecule.parse(strandLines.join("\n"), "strand.pdb")
    check(s.secondary.sheet >= 4, "geometric sheet assignment")
    var sheetFaces=0
    for (i=0;i<s.cartoon.length;i++) if (s.cartoon[i].secondary === "sheet") sheetFaces++
    check(sheetFaces > 0, "sheet cartoon faces")

    var forced=["HELIX    1   1 ALA A    1  ALA A    8  1                                   8"].concat(strandLines)
    var o = Molecule.parse(forced.join("\n"), "forced.pdb")
    check(o.atoms[0].secondary === "helix", "file HELIX not overwritten by geometry")
    check(o.secondary.helix === 8, "file helix residue count")

    console.log("Parser tests passed")
    Qt.quit()
  }
}
