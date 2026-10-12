import {
  FiMusic,
  FiCoffee,
  FiSun,
  FiUsers,
  FiCpu,
  FiFeather,
} from "react-icons/fi";
export function CategoryIcon({ id }: { id: string }) {
  const Icon =
    (
      {
        music: FiMusic,
        food: FiCoffee,
        wellness: FiSun,
        community: FiUsers,
        technology: FiCpu,
        arts: FiFeather,
      } as Record<string, typeof FiMusic>
    )[id] || FiFeather;
  return <Icon aria-hidden="true" />;
}
