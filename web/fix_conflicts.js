const fs = require('fs');
const files = [
  'src/features/tenant/pages/reservation-steps/components/AddressCascadeFields.jsx',
  'src/features/tenant/pages/reservation-steps/components/EmploymentSection.jsx',
  'src/features/tenant/pages/reservation-steps/components/PersonalInfoSection.jsx',
  'src/features/tenant/hooks/useReservationFlow.js',
  'src/features/tenant/pages/reservation-steps/ReservationVisitStep.jsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    // We match from <<<<<<< HEAD\n to \n=======\n
    // And from \n=======\n to \n>>>>>>> main\n
    // And we KEEP the HEAD part (group 1).
    const regex = /<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n[\s\S]*?\r?\n>>>>>>> main\r?\n?/g;
    const newContent = content.replace(regex, '$1');
    fs.writeFileSync(f, newContent);
    console.log('Fixed ' + f);
  }
});
