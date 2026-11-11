// 2024 presidential results by state. margin = Trump minus Harris, percentage
// points (positive = Republican). Certified results; Trump 312, Harris 226.
// Maine and Nebraska split electoral votes by district: the `split` field
// records how the 2024 district votes went and the game keeps them fixed.
// Tile grid (col,row) is a standard equal-area US layout.

export const STATES = [
  ["AK","Alaska",3,13.1,0,0],["ME","Maine",4,-7.1,11,0,{ R: 1, D: 3 }],
  ["WI","Wisconsin",10,0.9,6,1],["VT","Vermont",3,-31.5,10,1],["NH","New Hampshire",4,-2.8,11,1],
  ["WA","Washington",12,-18.2,1,2],["ID","Idaho",4,36.5,2,2],["MT","Montana",4,20.0,3,2],["ND","North Dakota",3,36.5,4,2],
  ["MN","Minnesota",10,-4.2,5,2],["IL","Illinois",19,-10.9,6,2],["MI","Michigan",15,1.4,7,2],["NY","New York",28,-12.6,9,2],["MA","Massachusetts",11,-25.2,10,2],
  ["OR","Oregon",8,-14.3,1,3],["NV","Nevada",6,3.1,2,3],["WY","Wyoming",3,45.8,3,3],["SD","South Dakota",3,29.2,4,3],
  ["IA","Iowa",6,13.2,5,3],["IN","Indiana",11,19.0,6,3],["OH","Ohio",17,11.2,7,3],["PA","Pennsylvania",19,1.7,8,3],
  ["NJ","New Jersey",14,-5.9,9,3],["CT","Connecticut",7,-14.5,10,3],["RI","Rhode Island",4,-13.8,11,3],
  ["CA","California",54,-20.2,1,4],["UT","Utah",6,21.6,2,4],["CO","Colorado",10,-11.0,3,4],["NE","Nebraska",5,20.5,4,4,{ R: 4, D: 1 }],
  ["MO","Missouri",10,18.4,5,4],["KY","Kentucky",8,30.5,6,4],["WV","West Virginia",4,41.9,7,4],["VA","Virginia",13,-5.8,8,4],
  ["MD","Maryland",10,-28.5,9,4],["DE","Delaware",3,-14.7,10,4],
  ["AZ","Arizona",11,5.5,2,5],["NM","New Mexico",5,-6.0,3,5],["KS","Kansas",6,16.1,4,5],["AR","Arkansas",6,30.6,5,5],
  ["TN","Tennessee",11,29.7,6,5],["NC","North Carolina",16,3.2,7,5],["SC","South Carolina",9,17.8,8,5],["DC","District of Columbia",3,-83.8,9,5],
  ["OK","Oklahoma",7,34.3,4,6],["LA","Louisiana",8,22.0,5,6],["MS","Mississippi",6,22.9,6,6],["AL","Alabama",9,30.5,7,6],["GA","Georgia",16,2.2,8,6],
  ["HI","Hawaii",4,-23.1,0,7],["TX","Texas",40,13.7,4,7],["FL","Florida",30,13.1,9,7],
].map(([id, name, ev, margin, col, row, split]) => ({ id, name, ev, margin, col, row, split }));

export const ELECTION_SOURCE = "Certified 2024 presidential results (state margins rounded to 0.1 point)";

// Electoral votes for a given uniform swing toward Democrats (points of margin).
export function electoralVotes(demSwing) {
  let R = 0, D = 0;
  for (const s of STATES) {
    const m = s.margin - demSwing;
    if (s.split) {
      // statewide winner takes the 2 at-large votes; districts held fixed
      const atLargeR = m > 0 ? 2 : 0;
      const districtR = s.split.R - (s.margin > 0 ? 2 : 0);
      R += atLargeR + districtR;
      D += s.ev - atLargeR - districtR;
    } else if (m > 0) R += s.ev; else D += s.ev;
  }
  return { R, D };
}
