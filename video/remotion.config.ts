import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setCrf(17);
// Screen footage is decoded by several render tabs at once; a small cache evicts frames before
// they are used and the render fails with "No frame found at position".
Config.setOffthreadVideoCacheSizeInBytes(1536 * 1024 * 1024);
Config.setConcurrency(4);
