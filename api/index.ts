import appPromise from "../server";

export const maxDuration = 60; // Allow up to 60 seconds for Vercel Serverless Function

export default async (req: any, res: any) => {
  try {
    const app = await appPromise;
    app(req, res);
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: String(error) });
  }
};
