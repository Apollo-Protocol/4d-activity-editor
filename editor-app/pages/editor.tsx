import ActivityDiagramWrap from "@/components/ActivityDiagramWrap";
import Head from "next/head";

export default function Editor() {
  return (
    <>
      <Head>
        <title>Activity Diagram Editor | Editor</title>
        <meta name="description" content="HDQM activity diagram editor" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <ActivityDiagramWrap />
    </>
  );
}
