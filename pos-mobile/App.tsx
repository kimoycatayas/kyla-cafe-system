import { StatusBar } from "expo-status-bar";
import Navigation from "./src/lib/navigation";

export default function App() {
  return (
    <>
      <Navigation />
      <StatusBar style="auto" />
    </>
  );
}
