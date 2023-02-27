export interface Activity {
  id: string;
  name: string;
  type: string;
  description?: string;
  beginning: number;
  ending: number;
  participations?: Map<string, Participation>;
}

export interface Individual {
  id: string;
  name: string;
  type: string;
  description?: string;
}

export interface Participation {
  individualId: string;
  type: string;
  role: string;
}

export function generateDummyActivities() {
  const activities = new Map<string, Activity>();
  const individuals = new Map<string, Individual>();
  const participations1 = new Map<string, Participation>();
  const participations2 = new Map<string, Participation>();
  const participations3 = new Map<string, Participation>();

  participations1.set("a", {
    individualId: "a",
    type: "a participation",
    role: "important",
  });

  participations1.set("b", {
    individualId: "b",
    type: "anot  participation",
    role: "important",
  });

  participations2.set("b", {
    individualId: "b",
    type: "anot  participation",
    role: "important",
  });

  participations2.set("c", {
    individualId: "c",
    type: "anot  participation",
    role: "important",
  });

  participations3.set("a", {
    individualId: "a",
    type: "a participation",
    role: "important",
  });

  participations3.set("c", {
    individualId: "c",
    type: "anot  participation",
    role: "important",
  });

  activities.set("1", {
    id: "1",
    name: "Pick up the runner",
    type: "action",
    description: "doing a thing",
    beginning: 3,
    ending: 4,
    participations: participations1,
  });

  activities.set("2", {
    id: "2",
    name: "Doing some torque",
    type: "action",
    description: "doing another thing",
    beginning: 5,
    ending: 7,
    participations: participations2,
  });

  activities.set("3", {
    id: "3",
    name: "Validation",
    type: "action",
    description: "doing another thing",
    beginning: 1,
    ending: 2.5,
    participations: participations3,
  });

  individuals.set("a", {
    id: "a",
    name: "Nutrunner",
    type: "nutrunner",
    description: "like a screwdriver",
  });

  individuals.set("b", {
    id: "b",
    name: "Worker",
    type: "person",
    description: "worker",
  });

  individuals.set("c", {
    id: "c",
    name: "Car",
    type: "car",
    description: "car",
  });

  const model = {
    activities: activities,
    individuals: individuals,
  };

  return model;
}

export function generateDummyActivities2() {
  const activities = new Map<string, Activity>();
  const individuals = new Map<string, Individual>();
  const participations1 = new Map<string, Participation>();
  const participations2 = new Map<string, Participation>();
  const participations3 = new Map<string, Participation>();

  participations1.set("a", {
    individualId: "a",
    type: "a participation",
    role: "important",
  });

  participations1.set("b", {
    individualId: "b",
    type: "anot  participation",
    role: "important",
  });

  participations2.set("b", {
    individualId: "b",
    type: "anot  participation",
    role: "important",
  });

  participations2.set("c", {
    individualId: "c",
    type: "anot  participation",
    role: "important",
  });

  participations3.set("a", {
    individualId: "a",
    type: "a participation",
    role: "important",
  });

  participations3.set("c", {
    individualId: "c",
    type: "anot  participation",
    role: "important",
  });

  activities.set("1", {
    id: "1",
    name: "Picking up the runner",
    type: "action",
    description: "doing a thing",
    beginning: 3,
    ending: 4,
    participations: participations1,
  });

  activities.set("2", {
    id: "2",
    name: "Doing some torque",
    type: "action",
    description: "doing another thing",
    beginning: 5,
    ending: 7,
    participations: participations2,
  });

  activities.set("3", {
    id: "3",
    name: "Passing validation",
    type: "action",
    description: "doing another thing",
    beginning: 1,
    ending: 2.5,
    participations: participations3,
  });

  individuals.set("a", {
    id: "a",
    name: "Nutrunner",
    type: "nutrunner",
    description: "like a screwdriver",
  });

  individuals.set("b", {
    id: "b",
    name: "Worker",
    type: "person",
    description: "worker",
  });

  individuals.set("c", {
    id: "c",
    name: "Car",
    type: "car",
    description: "car",
  });

  individuals.set("d", {
    id: "d",
    name: "Car2",
    type: "car2",
    description: "car2",
  });

  const model = {
    activities: activities,
    individuals: individuals,
  };

  return model;
}
