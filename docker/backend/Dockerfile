FROM eclipse-temurin:21-jdk AS build

WORKDIR /app

# Install maven (Debian-based Temurin images use apt)
RUN apt-get update \
	&& apt-get install -y maven \
	&& rm -rf /var/lib/apt/lists/*

COPY Backend/java-api/pom.xml ./
COPY Backend/java-api/src ./src

RUN mvn -DskipTests package

FROM eclipse-temurin:21-jdk AS runtime

WORKDIR /app
COPY --from=build /app/target/biopresence-api-0.0.1-SNAPSHOT.jar ./app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "./app.jar"]
