export interface MitreTechnique {
  id: string; // e.g. T1110
  name: string; // e.g. Brute Force
  tacticId: string; // e.g. TA0006
  tacticName: string; // e.g. Credential Access
  description: string;
}

export interface MitreTactic {
  id: string;
  name: string;
  description: string;
  techniques: MitreTechnique[];
}

export const MITRE_TACTICS: MitreTactic[] = [
  {
    id: 'TA0001',
    name: 'Initial Access',
    description: 'Techniques used to gain an initial foothold within a network.',
    techniques: [
      { id: 'T1190', name: 'Exploit Public-Facing Application', tacticId: 'TA0001', tacticName: 'Initial Access', description: 'Adversaries exploit software vulnerabilities in web/auth services.' },
      { id: 'T1566', name: 'Phishing', tacticId: 'TA0001', tacticName: 'Initial Access', description: 'Adversaries send malicious messages to gain access.' },
      { id: 'T1078', name: 'Valid Accounts', tacticId: 'TA0001', tacticName: 'Initial Access', description: 'Adversaries obtain and use credentials of existing user accounts.' },
    ],
  },
  {
    id: 'TA0002',
    name: 'Execution',
    description: 'Techniques that result in adversary-controlled code running on a local or remote system.',
    techniques: [
      { id: 'T1059', name: 'Command & Scripting Interpreter', tacticId: 'TA0002', tacticName: 'Execution', description: 'Adversaries abuse command interpreters to execute commands.' },
      { id: 'T1204', name: 'User Execution', tacticId: 'TA0002', tacticName: 'Execution', description: 'Adversaries rely on specific actions by a user to execute code.' },
    ],
  },
  {
    id: 'TA0003',
    name: 'Persistence',
    description: 'Techniques adversaries use to keep access across restarts or credential changes.',
    techniques: [
      { id: 'T1098', name: 'Account Manipulation', tacticId: 'TA0003', tacticName: 'Persistence', description: 'Adversaries manipulate accounts to maintain access.' },
      { id: 'T1136', name: 'Create Account', tacticId: 'TA0003', tacticName: 'Persistence', description: 'Adversaries create accounts to maintain access.' },
    ],
  },
  {
    id: 'TA0005',
    name: 'Defense Evasion',
    description: 'Techniques adversaries use to avoid detection throughout their compromise.',
    techniques: [
      { id: 'T1070', name: 'Indicator Removal', tacticId: 'TA0005', tacticName: 'Defense Evasion', description: 'Adversaries delete or modify audit logs to cover tracks.' },
      { id: 'T1562', name: 'Impair Defenses', tacticId: 'TA0005', tacticName: 'Defense Evasion', description: 'Adversaries disable security software or audit logging.' },
    ],
  },
  {
    id: 'TA0006',
    name: 'Credential Access',
    description: 'Techniques for stealing credentials like account names and passwords.',
    techniques: [
      { id: 'T1110', name: 'Brute Force', tacticId: 'TA0006', tacticName: 'Credential Access', description: 'Adversaries use password spraying or dictionary attacks against auth endpoints.' },
      { id: 'T1555', name: 'Credentials from Password Stores', tacticId: 'TA0006', tacticName: 'Credential Access', description: 'Adversaries search password stores for saved credentials.' },
      { id: 'T1003', name: 'OS Credential Dumping', tacticId: 'TA0006', tacticName: 'Credential Access', description: 'Adversaries dump credentials from memory or SAM/LSASS.' },
    ],
  },
  {
    id: 'TA0007',
    name: 'Discovery',
    description: 'Techniques adversaries use to gain knowledge about the system and internal network.',
    techniques: [
      { id: 'T1046', name: 'Network Service Discovery', tacticId: 'TA0007', tacticName: 'Discovery', description: 'Adversaries scan network ports to find running services.' },
      { id: 'T1082', name: 'System Information Discovery', tacticId: 'TA0007', tacticName: 'Discovery', description: 'Adversaries get detailed information about OS and architecture.' },
      { id: 'T1087', name: 'Account Discovery', tacticId: 'TA0007', tacticName: 'Discovery', description: 'Adversaries enumerate system or domain user accounts.' },
    ],
  },
  {
    id: 'TA0008',
    name: 'Lateral Movement',
    description: 'Techniques adversaries use to enter and control remote systems on a network.',
    techniques: [
      { id: 'T1021.004', name: 'SSH Remote Services', tacticId: 'TA0008', tacticName: 'Lateral Movement', description: 'Adversaries log into remote SSH servers to move laterally.' },
      { id: 'T1021.001', name: 'Remote Desktop Protocol', tacticId: 'TA0008', tacticName: 'Lateral Movement', description: 'Adversaries log into remote RDP sessions.' },
    ],
  },
  {
    id: 'TA0011',
    name: 'Command & Control',
    description: 'Techniques adversaries use to communicate with systems under their control.',
    techniques: [
      { id: 'T1071', name: 'Application Layer Protocol', tacticId: 'TA0011', tacticName: 'Command & Control', description: 'Adversaries communicate using standard web protocols like HTTP/HTTPS/DNS.' },
      { id: 'T1573', name: 'Encrypted Channel', tacticId: 'TA0011', tacticName: 'Command & Control', description: 'Adversaries employ encryption to hide C2 traffic.' },
    ],
  },
];

/** Lookup technique info by ID */
export function getTechniqueInfo(techniqueId: string): MitreTechnique | null {
  for (const tactic of MITRE_TACTICS) {
    const found = tactic.techniques.find((t) => t.id.toLowerCase() === techniqueId.toLowerCase());
    if (found) return found;
  }
  return null;
}
