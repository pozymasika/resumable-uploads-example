# generate a 10mb file
dd if=/dev/zero of=10mb.txt count=10240 bs=1024
# chunk it into 10 parts
split -b 1m 10mb.txt
# upload the parts
CHUNKSIZE=1048576
INDEX=0
for i in {a..j}; do
  INDEX=$((INDEX + 1))
  # sleep 1 second between each upload
  sleep 1
  FILENAME="xa$i"
  echo "Uploading $FILENAME"
  # generate content range header from byte size
  START=$((CHUNKSIZE * (INDEX - 1)))
  END=$((START + CHUNKSIZE - 1))
  CONTENT_RANGE="bytes $START-$END/10485760"
  echo "Content-Range: $CONTENT_RANGE"
  curl -X POST http://localhost:3000/upload -H "Content-Type: multipart/form-data" -H "Chunk-Size: $CHUNKSIZE" -H "Unique-File-Id: 10mb.txt" -H "Content-Range: $CONTENT_RANGE" -F "file=@$FILENAME"
done
