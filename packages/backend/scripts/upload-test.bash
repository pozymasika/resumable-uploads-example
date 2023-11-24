# generate a 10mb file
dd if=/dev/zero of=10mb.txt count=10240 bs=1024
# chunk into 10 parts
split -b 1m 10mb.txt
# upload to endpoint
CHUNKSIZE=1048576
INDEX=0
for i in {a..j}; do
  INDEX=$((INDEX + 1))
  FILENAME="xa$i"
  echo "Uploading $FILENAME"
  START=$((CHUNKSIZE * (INDEX - 1)))
  END=$((START + CHUNKSIZE - 1))
  CONTENTRANGE="bytes $START-$END/10485760"
  echo "$CONTENTRANGE"
  curl -X POST http://localhost:3000/upload \
    -H "Content-Type: multipart/form-data" \
    -H "Chunk-Size: $CHUNKSIZE" \
    -H "File-Id: 10mb.txt" \
    -H "Content-Range: $CONTENTRANGE" \
    -F "file=@$FILENAME"
  sleep 1
done