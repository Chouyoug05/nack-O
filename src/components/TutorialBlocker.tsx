import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

const TutorialBlocker = ({ children }: Props) => {
  // Fonctionnalités débloquées : toujours afficher le contenu
  return <>{children}</>;
};

export default TutorialBlocker;
