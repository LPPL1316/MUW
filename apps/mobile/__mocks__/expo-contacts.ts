/**
 * Stand-in for expo-contacts in tests (TASK-262 C): the permission and the
 * contacts are in `phone`, which a test sets; `asked` counts the system
 * questions.
 */

type Permission = { granted: boolean; canAskAgain: boolean };

export const phone: {
  /** What the phone says before it is asked. */
  now: Permission;
  /** What the person answers to the system question. */
  answer: Permission;
  /** The numbers of each contact, as written there. */
  contacts: string[][];
  asked: number;
  read: number;
} = {
  now: { granted: false, canAskAgain: true },
  answer: { granted: true, canAskAgain: true },
  contacts: [],
  asked: 0,
  read: 0,
};

/** Back to a phone never asked, without contacts. */
export function resetPhone(): void {
  phone.now = { granted: false, canAskAgain: true };
  phone.answer = { granted: true, canAskAgain: true };
  phone.contacts = [];
  phone.asked = 0;
  phone.read = 0;
}

export enum ContactField {
  PHONES = "phones",
}

export async function getPermissionsAsync(): Promise<Permission> {
  return phone.now;
}

export async function requestPermissionsAsync(): Promise<Permission> {
  phone.asked += 1;
  phone.now = phone.answer;
  return phone.answer;
}

export const Contact = {
  async getAllDetails(): Promise<
    { id: string; phones: { id: string; number: string }[] }[]
  > {
    phone.read += 1;
    return phone.contacts.map((numbers, i) => ({
      id: `contact-${i}`,
      phones: numbers.map((number, j) => ({ id: `phone-${i}-${j}`, number })),
    }));
  },
};
