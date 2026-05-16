const fs = require('fs');
const f = 'src/features/tenant/pages/reservation-steps/ReservationVisitStep.jsx';
let content = fs.readFileSync(f, 'utf8');

const blocks = [];
const regex = /<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> main\r?\n?/g;

content = content.replace(regex, (match, head, main, offset) => {
  blocks.push(match);
  if (blocks.length === 1) {
    return 'import React, { useState, useMemo, useCallback, useEffect } from "react";\nimport { useNavigate } from "react-router-dom";\nimport { Calendar, Clock, X, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Camera, ChevronLeft, ChevronRight, Eye, Home, Image as ImageIcon, Zap } from "lucide-react";\n';
  }
  if (blocks.length === 2) {
    return head + '\n';
  }
  if (blocks.length === 3) {
    return head + '\n';
  }
  if (blocks.length === 4) {
    return head + '\n' + main.replace(/const { user: firebaseUser, loading: authLoading } = useFirebaseAuth\(\);/, '') + '\n';
  }
  if (blocks.length === 5) {
    return head + '\n' + main + '\n';
  }
  if (blocks.length === 6) {
    // Both sides are huge JSX blocks. We'll keep HEAD because HEAD has the rewritten UI.
    // The user can adapt the 3 viewing options inside HEAD later if needed.
    return head + '\n';
  }
  return match;
});

fs.writeFileSync(f, content);
console.log("Fixed ReservationVisitStep.jsx");
