import QtQuick
import "../Molecule.js" as Molecule

QtObject {
  function check(condition, message) {
    if (!condition) throw new Error(message)
  }

  Component.onCompleted: {
    var pdb = [
      "ATOM      1  N   GLY A   1      11.104  13.207   9.100  1.00 20.00           N  ",
      "ATOM      2  CA  GLY A   1      12.000  12.100   9.400  1.00 21.00           C  ",
      "HETATM    3  O   HOH B   2      14.000  11.000   8.000  1.00 30.00           O  "
    ].join("\n")
    var p = Molecule.parse(pdb, "tiny.pdb")
    check(p.atomCount === 3, "PDB atom count")
    check(p.chainCount === 2, "PDB chain count")
    check(p.residueCount === 2, "PDB residue count")
    check(p.ligandCount === 1, "PDB ligand count")

    var cif = [
      "data_tiny", "#", "loop_",
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
    console.log("Parser tests passed")
    Qt.quit()
  }
}
