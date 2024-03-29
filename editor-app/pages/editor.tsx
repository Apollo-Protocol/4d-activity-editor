import ActivityDiagramWrap from "@/components/ActivityDiagramWrap";
import Head from "next/head";

export default function Editor() {
  return (
    <>
      <Head>
        <title>Editor | Activity Diagram Editor</title>
        <meta name="description" content="4d activity model development tool" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="favicon.ico" />
      </Head>

      <ActivityDiagramWrap />
    </>
  );
}
